// supabase/functions/gdrive-upload/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface ServiceAccount {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

interface DriveAccount {
  sa: ServiceAccount;
  folderId: string;
  index: number;
}

interface QuotaInfo {
  account: DriveAccount;
  freeBytes: number;
}

/* ─────────────────────────────────────────
   LOAD ALL ACCOUNTS FROM ENV
   
   Supports two modes:
   
   MODE A — Multi-account (new):
     GDRIVE_ACCOUNTS    = JSON array of service account objects
     GDRIVE_FOLDER_IDS  = JSON array of folder ID strings
   
   MODE B — Single account (legacy fallback):
     GDRIVE_SERVICE_ACCOUNT = single service account JSON object
     GDRIVE_FOLDER_ID       = single folder ID string
───────────────────────────────────────── */
function loadAccounts(): DriveAccount[] {
  const accountsRaw = Deno.env.get("GDRIVE_ACCOUNTS");
  const folderIdsRaw = Deno.env.get("GDRIVE_FOLDER_IDS");

  // MODE A: multi-account
  if (accountsRaw && folderIdsRaw) {
    let accounts: ServiceAccount[];
    let folderIds: string[];

    try {
      accounts = JSON.parse(accountsRaw);
      folderIds = JSON.parse(folderIdsRaw);
    } catch {
      throw new Error(
        "GDRIVE_ACCOUNTS or GDRIVE_FOLDER_IDS is not valid JSON."
      );
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("GDRIVE_ACCOUNTS must be a non-empty JSON array.");
    }
    if (!Array.isArray(folderIds) || folderIds.length !== accounts.length) {
      throw new Error(
        `GDRIVE_FOLDER_IDS must be a JSON array with exactly ${accounts.length} entries (one per account).`
      );
    }

    return accounts.map((sa, index) => ({
      sa,
      folderId: folderIds[index],
      index,
    }));
  }

  // MODE B: single legacy account
  const singleSARaw = Deno.env.get("GDRIVE_SERVICE_ACCOUNT");
  const singleFolderId = Deno.env.get("GDRIVE_FOLDER_ID");

  if (singleSARaw && singleFolderId) {
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(singleSARaw);
    } catch {
      throw new Error("GDRIVE_SERVICE_ACCOUNT is not valid JSON.");
    }
    return [{ sa, folderId: singleFolderId, index: 0 }];
  }

  throw new Error(
    "No Google Drive credentials found. Set either GDRIVE_ACCOUNTS + GDRIVE_FOLDER_IDS (multi-account) or GDRIVE_SERVICE_ACCOUNT + GDRIVE_FOLDER_ID (single account)."
  );
}

/* ─────────────────────────────────────────
   GET ACCESS TOKEN FOR A SERVICE ACCOUNT
───────────────────────────────────────── */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const pemKey = sa.private_key as string;
  const pemBody = pemKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = getNumericDate(0);
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      // drive.file: access only to files created by this app
      // drive: full access needed to read quota
      scope:
        "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: now,
    },
    cryptoKey
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(
      `Failed to get access token for ${sa.client_email}: ${JSON.stringify(tokenData)}`
    );
  }
  return tokenData.access_token;
}

/* ─────────────────────────────────────────
   GET FREE BYTES FOR AN ACCOUNT
   Returns -1 if quota cannot be determined
   (some Workspace accounts report unlimited)
───────────────────────────────────────── */
async function getFreeBytesForAccount(
  account: DriveAccount,
  token: string
): Promise<number> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    const quota = data?.storageQuota;

    if (!quota) return -1;

    // Some Workspace / GSuite accounts report no limit
    if (!quota.limit) return Number.MAX_SAFE_INTEGER;

    const limit = parseInt(quota.limit, 10);
    const usage = parseInt(quota.usage ?? "0", 10);
    return Math.max(0, limit - usage);
  } catch {
    return -1; // treat as unknown — will be tried last
  }
}

/* ─────────────────────────────────────────
   RANK ACCOUNTS BY FREE SPACE
   Accounts with unknown quota (-1) are placed last.
───────────────────────────────────────── */
async function rankAccountsByFreeSpace(
  accounts: DriveAccount[]
): Promise<QuotaInfo[]> {
  // Get tokens + quota in parallel for speed
  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const token = await getAccessToken(account.sa);
      const freeBytes = await getFreeBytesForAccount(account, token);
      return { account, freeBytes };
    })
  );

  const quotaList: QuotaInfo[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      quotaList.push(result.value);
    }
    // fulfilled with -1 (unknown quota) is still included — unknown last
  }

  // Sort: most free space first; unknown quota (-1) goes to end
  quotaList.sort((a, b) => {
    if (a.freeBytes === -1 && b.freeBytes === -1) return 0;
    if (a.freeBytes === -1) return 1;
    if (b.freeBytes === -1) return -1;
    return b.freeBytes - a.freeBytes;
  });

  return quotaList;
}

/* ─────────────────────────────────────────
   UPLOAD A FILE TO ONE DRIVE ACCOUNT
───────────────────────────────────────── */
async function uploadToDrive(
  file: File,
  account: DriveAccount,
  token: string
): Promise<{ gdrive_file_id: string; gdrive_web_view_link: string; gdrive_download_link: string; gdrive_account_index: number }> {
  const metadata = JSON.stringify({
    name: file.name,
    parents: [account.folderId],
  });

  const uploadBody = new FormData();
  uploadBody.append(
    "metadata",
    new Blob([metadata], { type: "application/json" })
  );
  uploadBody.append("file", file);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadBody,
    }
  );

  const result = await uploadRes.json();
  if (!result.id) {
    throw new Error(
      `Drive upload failed for account #${account.index} (${account.sa.client_email}): ${JSON.stringify(result)}`
    );
  }

  // Make file publicly readable
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${result.id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  if (!permRes.ok) {
    // Non-fatal: file uploaded but might not be public; log and continue
    console.warn(
      `Warning: Could not set public permission for file ${result.id} on account #${account.index}`
    );
  }

  return {
    gdrive_file_id: result.id,
    gdrive_web_view_link: result.webViewLink,
    gdrive_download_link: `https://drive.google.com/uc?export=download&id=${result.id}`,
    gdrive_account_index: account.index,
  };
}

/* ─────────────────────────────────────────
   MAIN HANDLER
───────────────────────────────────────── */
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Parse incoming file
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided in form data.");

    // 2. Load all configured Drive accounts
    const allAccounts = loadAccounts();

    // 3. If only one account, skip quota check for speed
    if (allAccounts.length === 1) {
      const account = allAccounts[0];
      const token = await getAccessToken(account.sa);
      const uploadResult = await uploadToDrive(file, account, token);

      return new Response(JSON.stringify(uploadResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 4. Multiple accounts: rank by free space
    const ranked = await rankAccountsByFreeSpace(allAccounts);

    if (ranked.length === 0) {
      throw new Error(
        "Could not authenticate with any configured Google Drive account."
      );
    }

    // 5. Try accounts in order (most space first), with automatic fallback
    let lastError: Error | null = null;

    for (const { account } of ranked) {
      try {
        console.log(
          `Attempting upload to Drive account #${account.index} (${account.sa.client_email})`
        );

        // Re-use token obtained during quota check
        const token = await getAccessToken(account.sa);
        const uploadResult = await uploadToDrive(file, account, token);

        console.log(
          `Upload succeeded on account #${account.index}`
        );

        return new Response(JSON.stringify(uploadResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (err) {
        lastError = err as Error;
        console.error(
          `Upload failed on account #${account.index}: ${lastError.message} — trying next account…`
        );
        // Continue to next account
      }
    }

    // All accounts exhausted
    throw new Error(
      `All ${ranked.length} Google Drive account(s) failed. Last error: ${lastError?.message}`
    );
  } catch (err) {
    console.error("gdrive-upload fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
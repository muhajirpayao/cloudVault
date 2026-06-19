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
  folderId: string;   // Shared Drive ID
  index: number;
}

interface QuotaInfo {
  account: DriveAccount;
  freeBytes: number;
}

/* ─────────────────────────────────────────
   LOAD ALL ACCOUNTS FROM ENV

   MODE A — Multi-account (new):
     GDRIVE_ACCOUNTS    = JSON array of service account objects
     GDRIVE_FOLDER_IDS  = JSON array of Shared Drive IDs

   MODE B — Single account (legacy fallback):
     GDRIVE_SERVICE_ACCOUNT = single service account JSON
     GDRIVE_FOLDER_ID       = single Shared Drive ID
───────────────────────────────────────── */
function loadAccounts(): DriveAccount[] {
  const accountsRaw  = Deno.env.get("GDRIVE_ACCOUNTS");
  const folderIdsRaw = Deno.env.get("GDRIVE_FOLDER_IDS");

  if (accountsRaw && folderIdsRaw) {
    let accounts: ServiceAccount[];
    let folderIds: string[];
    try {
      accounts  = JSON.parse(accountsRaw);
      folderIds = JSON.parse(folderIdsRaw);
    } catch {
      throw new Error("GDRIVE_ACCOUNTS or GDRIVE_FOLDER_IDS is not valid JSON.");
    }
    if (!Array.isArray(accounts) || accounts.length === 0)
      throw new Error("GDRIVE_ACCOUNTS must be a non-empty JSON array.");
    if (!Array.isArray(folderIds) || folderIds.length !== accounts.length)
      throw new Error(`GDRIVE_FOLDER_IDS must have exactly ${accounts.length} entries.`);

    return accounts.map((sa, index) => ({ sa, folderId: folderIds[index], index }));
  }

  const singleSARaw   = Deno.env.get("GDRIVE_SERVICE_ACCOUNT");
  const singleFolderId = Deno.env.get("GDRIVE_FOLDER_ID");
  if (singleSARaw && singleFolderId) {
    let sa: ServiceAccount;
    try { sa = JSON.parse(singleSARaw); } catch {
      throw new Error("GDRIVE_SERVICE_ACCOUNT is not valid JSON.");
    }
    return [{ sa, folderId: singleFolderId, index: 0 }];
  }

  throw new Error(
    "No Google Drive credentials found. Set GDRIVE_ACCOUNTS + GDRIVE_FOLDER_IDS or GDRIVE_SERVICE_ACCOUNT + GDRIVE_FOLDER_ID."
  );
}

/* ─────────────────────────────────────────
   GET ACCESS TOKEN FOR A SERVICE ACCOUNT
───────────────────────────────────────── */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const pemBody = sa.private_key
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

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope:
        "https://www.googleapis.com/auth/drive " +
        "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
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
   GET FREE BYTES FOR A SHARED DRIVE
   Shared Drives report storage under driveThemes/storageQuota.
   Falls back to -1 (unknown) if it can't be determined.
───────────────────────────────────────── */
async function getFreeBytesForAccount(
  account: DriveAccount,
  token: string
): Promise<number> {
  try {
    // Check the Shared Drive's own storage info
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/drives/${account.folderId}?fields=storageQuota`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const driveData = await driveRes.json();
    const quota = driveData?.storageQuota;

    if (quota?.limit) {
      const limit = parseInt(quota.limit, 10);
      const usage = parseInt(quota.usage ?? "0", 10);
      return Math.max(0, limit - usage);
    }

    // Fallback: check the service account's own about quota
    const aboutRes = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const aboutData = await aboutRes.json();
    const aboutQuota = aboutData?.storageQuota;

    if (!aboutQuota?.limit) return Number.MAX_SAFE_INTEGER; // unlimited
    const limit = parseInt(aboutQuota.limit, 10);
    const usage = parseInt(aboutQuota.usage ?? "0", 10);
    return Math.max(0, limit - usage);
  } catch {
    return -1;
  }
}

/* ─────────────────────────────────────────
   RANK ACCOUNTS BY FREE SPACE
───────────────────────────────────────── */
async function rankAccountsByFreeSpace(
  accounts: DriveAccount[]
): Promise<QuotaInfo[]> {
  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const token     = await getAccessToken(account.sa);
      const freeBytes = await getFreeBytesForAccount(account, token);
      return { account, freeBytes };
    })
  );

  const quotaList: QuotaInfo[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") quotaList.push(result.value);
  }

  quotaList.sort((a, b) => {
    if (a.freeBytes === -1 && b.freeBytes === -1) return 0;
    if (a.freeBytes === -1) return 1;
    if (b.freeBytes === -1) return -1;
    return b.freeBytes - a.freeBytes;
  });

  return quotaList;
}

/* ─────────────────────────────────────────
   UPLOAD FILE TO A SHARED DRIVE
   KEY FIX: supportsAllDrives=true on every request
───────────────────────────────────────── */
async function uploadToDrive(
  file: File,
  account: DriveAccount,
  token: string
): Promise<{
  gdrive_file_id: string;
  gdrive_web_view_link: string;
  gdrive_download_link: string;
  gdrive_account_index: number;
}> {
  const metadata = JSON.stringify({
    name: file.name,
    parents: [account.folderId], // Shared Drive ID
  });

  const uploadBody = new FormData();
  uploadBody.append("metadata", new Blob([metadata], { type: "application/json" }));
  uploadBody.append("file", file);

  // ✅ supportsAllDrives=true is required for Shared Drives
  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files" +
      "?uploadType=multipart" +
      "&fields=id,webViewLink,webContentLink" +
      "&supportsAllDrives=true",
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

  // Make file publicly readable — also needs supportsAllDrives=true
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${result.id}/permissions?supportsAllDrives=true`,
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
    console.warn(
      `Warning: Could not set public permission for file ${result.id} on account #${account.index}`
    );
  }

  return {
    gdrive_file_id:        result.id,
    gdrive_web_view_link:  result.webViewLink,
    gdrive_download_link:  `https://drive.google.com/uc?export=download&id=${result.id}`,
    gdrive_account_index:  account.index,
  };
}

/* ─────────────────────────────────────────
   MAIN HANDLER
───────────────────────────────────────── */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided in form data.");

    const allAccounts = loadAccounts();

    // Single account — skip quota check for speed
    if (allAccounts.length === 1) {
      const account = allAccounts[0];
      const token   = await getAccessToken(account.sa);
      const result  = await uploadToDrive(file, account, token);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Multiple accounts — pick the one with most free space
    const ranked = await rankAccountsByFreeSpace(allAccounts);
    if (ranked.length === 0)
      throw new Error("Could not authenticate with any configured Google Drive account.");

    let lastError: Error | null = null;
    for (const { account } of ranked) {
      try {
        console.log(`Trying account #${account.index} (${account.sa.client_email}) → Shared Drive ${account.folderId}`);
        const token  = await getAccessToken(account.sa);
        const result = await uploadToDrive(file, account, token);
        console.log(`✅ Upload succeeded on account #${account.index}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (err) {
        lastError = err as Error;
        console.error(`❌ Account #${account.index} failed: ${lastError.message} — trying next…`);
      }
    }

    throw new Error(
      `All ${ranked.length} Google Drive account(s) failed. Last error: ${lastError?.message}`
    );
  } catch (err) {
    console.error("gdrive-upload fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
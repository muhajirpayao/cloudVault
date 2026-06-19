// supabase/functions/gdrive-quota/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
/* ─────────────────────────────────────────
   GET ACCESS TOKEN FOR A SERVICE ACCOUNT
───────────────────────────────────────── */
async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
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
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    cryptoKey
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      `Token error for ${sa.client_email}: ${JSON.stringify(data)}`
    );
  }
  return data.access_token;
}

/* ─────────────────────────────────────────
   LOAD ALL ACCOUNTS FROM ENV
   Supports both GDRIVE_ACCOUNTS (array)
   and legacy GDRIVE_SERVICE_ACCOUNT (single)
───────────────────────────────────────── */
function loadAccounts(): { sa: any; index: number }[] {
  const multi = Deno.env.get("GDRIVE_ACCOUNTS");
  if (multi) {
    const arr = JSON.parse(multi);
    return arr.map((sa: any, index: number) => ({ sa, index }));
  }
  const single = Deno.env.get("GDRIVE_SERVICE_ACCOUNT");
  if (single) {
    return [{ sa: JSON.parse(single), index: 0 }];
  }
  throw new Error("No GDRIVE_ACCOUNTS or GDRIVE_SERVICE_ACCOUNT env found.");
}

/* ─────────────────────────────────────────
   MAIN HANDLER
───────────────────────────────────────── */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accounts = loadAccounts();

    const results = await Promise.all(
      accounts.map(async ({ sa, index }) => {
        try {
          const token = await getAccessToken(sa);

          // Fetch quota + user info
          const res = await fetch(
            "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user",
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const data = await res.json();
          const quota = data.storageQuota || {};

          const usage     = parseInt(quota.usage        || "0", 10);
          const usageInDrive = parseInt(quota.usageInDrive || "0", 10);
          const usageInTrash = parseInt(quota.usageInTrash || "0", 10);
          const limit     = quota.limit ? parseInt(quota.limit, 10) : null;
          const free      = limit !== null ? Math.max(0, limit - usage) : null;
          const email     = data.user?.emailAddress || sa.client_email;

          return {
            index,
            email,
            usage,
            usageInDrive,
            usageInTrash,
            limit,
            free,
            isUnlimited: limit === null,
            usedPercent: limit ? Math.round((usage / limit) * 100) : 0,
            status: "ok",
          };
        } catch (err: any) {
          return {
            index,
            email: sa.client_email,
            status: "error",
            error: err.message,
          };
        }
      })
    );

    // Compute combined totals (only for accounts with known limits)
    const knownAccounts = results.filter(
      (r) => r.status === "ok" && !r.isUnlimited && r.limit
    );
    const unlimitedAccounts = results.filter(
      (r) => r.status === "ok" && r.isUnlimited
    );

    const totalLimit = knownAccounts.reduce((s, r) => s + (r.limit || 0), 0);
    const totalUsage = results
      .filter((r) => r.status === "ok")
      .reduce((s, r) => s + (r.usage || 0), 0);
    const totalFree  = knownAccounts.reduce((s, r) => s + (r.free  || 0), 0);

    return new Response(
      JSON.stringify({
        accounts: results,
        summary: {
          totalAccounts:     results.length,
          activeAccounts:    results.filter((r) => r.status === "ok").length,
          errorAccounts:     results.filter((r) => r.status === "error").length,
          unlimitedAccounts: unlimitedAccounts.length,
          totalLimit:        totalLimit || null,
          totalUsage,
          totalFree:         totalFree  || null,
          totalUsedPercent:  totalLimit
            ? Math.round((totalUsage / totalLimit) * 100)
            : 0,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (err: any) {
    console.error("gdrive-quota error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
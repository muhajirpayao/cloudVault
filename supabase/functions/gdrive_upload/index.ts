// supabase/functions/gdrive-upload/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const serviceAccountRaw = Deno.env.get("GDRIVE_SERVICE_ACCOUNT");
  if (!serviceAccountRaw) throw new Error("GDRIVE_SERVICE_ACCOUNT env not set");

  const sa = JSON.parse(serviceAccountRaw);

  // Import the private key from the service account JSON
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
      scope: "https://www.googleapis.com/auth/drive.file",
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
    throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const folderId = Deno.env.get("GDRIVE_FOLDER_ID");
    if (!folderId) throw new Error("GDRIVE_FOLDER_ID env not set");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided in form data");

    const token = await getAccessToken();

    // Build multipart upload body
    const metadata = JSON.stringify({
      name: file.name,
      parents: [folderId],
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
      throw new Error("Drive upload failed: " + JSON.stringify(result));
    }

    // Make file publicly readable
    await fetch(
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

    return new Response(
      JSON.stringify({
        gdrive_file_id: result.id,
        gdrive_web_view_link: result.webViewLink,
        gdrive_download_link: `https://drive.google.com/uc?export=download&id=${result.id}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {+*
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
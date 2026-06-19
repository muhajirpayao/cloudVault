// functions/gdrive-upload/index.ts

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

async function getAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function pickAccount(supabase) {
  // Pick account that still has space
  const { data } = await supabase
    .from("gdrive_accounts")
    .select("*")
    .eq("is_active", true)
    .lt("used_bytes", supabase.raw("total_bytes"))  
    .order("used_bytes", { ascending: true })
    .limit(1)
    .single();
  return data;
}

Deno.serve(async (req) => {
  const formData = await req.formData();
  const file = formData.get("file");

  const supabase = createClient(...);
  const account = await pickAccount(supabase);
  const accessToken = await getAccessToken(account.refresh_token);

  // Upload to that Google Drive account
  const metadata = JSON.stringify({ name: file.name });
  const form = new FormData();
  form.append("metadata", new Blob([metadata], { type: "application/json" }));
  form.append("file", file);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  const uploaded = await uploadRes.json();

  // Update used storage in DB
  await supabase
    .from("gdrive_accounts")
    .update({ used_bytes: account.used_bytes + file.size })
    .eq("id", account.id);

  return new Response(JSON.stringify({ fileId: uploaded.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://oynuqcbqcxfoalmlxiwx.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bnVxY2JxY3hmb2FsbWx4aXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzE0ODgsImV4cCI6MjA5NTkwNzQ4OH0.04xWAzu6W_5inGAppDvRlDqrPoOOqbfSsAOdHyuAUEc";
const supabase      = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── HELPERS ── */
function getBucket(file) {
  const m = file.type;
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("video/")) return "videos";
  return "documents";
}
function getCategory(file) {
  const m = file.type;
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("video/")) return "videos";
  return "docs";
}
function getFileType(cat) {
  if (cat === "images") return "img";
  if (cat === "videos") return "vid";
  return "doc";
}
function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}
function formatGB(bytes) { return (bytes / 1024 ** 3).toFixed(2) + " GB"; }
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["","Weak","Fair","Good","Strong","Strong"];
  return { score, label: labels[score] || "Strong" };
}

/* ── STORAGE OPS ── */
async function uploadFile(file, userId) {
  const bucket = getBucket(file);
  const ext    = file.name.split(".").pop();
  const path   = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from("files").insert({
    user_id: userId, name: file.name, original_name: file.name,
    bucket, storage_path: path, size: file.size, mime_type: file.type, category: getCategory(file),
  });
  if (dbErr) throw dbErr;
  // update storage_used
  const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", userId).single();
  if (prof) {
    await supabase.from("profiles").update({ storage_used: (prof.storage_used || 0) + file.size }).eq("id", userId);
  }
}
async function getFileUrl(record) {
  if (record.bucket === "images") {
    const { data } = supabase.storage.from("images").getPublicUrl(record.storage_path);
    return data.publicUrl;
  }
  const { data, error } = await supabase.storage.from(record.bucket).createSignedUrl(record.storage_path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
async function downloadFile(record) {
  const url = await getFileUrl(record);
  const a = document.createElement("a");
  a.href = url; a.download = record.original_name; a.target = "_blank"; a.click();
}
async function deleteFile(record) {
  await supabase.storage.from(record.bucket).remove([record.storage_path]);
  await supabase.from("files").delete().eq("id", record.id);
  // update storage_used
  const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", record.user_id).single();
  if (prof) {
    const newUsed = Math.max(0, (prof.storage_used || 0) - (record.size || 0));
    await supabase.from("profiles").update({ storage_used: newUsed }).eq("id", record.user_id);
  }
}
async function fetchFiles(userId, category) {
  let q = supabase.from("files").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function fetchProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}

/* ── ADMIN OPS ── */
async function adminFetchAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function adminFetchAllFiles() {
  const { data, error } = await supabase.from("files").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function adminUpdateProfile(id, updates) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", id);
  if (error) throw error;
}
async function adminDeleteProfile(id) {
  const { data: files } = await supabase.from("files").select("*").eq("user_id", id);
  if (files && files.length > 0) {
    for (const f of files) {
      await supabase.storage.from(f.bucket).remove([f.storage_path]);
    }
    await supabase.from("files").delete().eq("user_id", id);
  }
  await supabase.from("profiles").delete().eq("id", id);
  // NOTE: this removes the profile row. The auth.users entry persists until
  // deleted from Supabase dashboard or via service_role key.
  // To fully block login, we rely on is_disabled flag checked at auth time.
}

// Admin creates user: uses signUp (anon key limitation).
// Requires "Disable email confirmations" in Supabase Auth → Settings → Email.
async function adminCreateUser({ full_name, email, password, storage_limit, is_admin }) {
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name }, emailRedirectTo: window.location.origin },
  });
  if (signUpErr) throw signUpErr;
  const newUserId = signUpData?.user?.id;
  if (!newUserId) throw new Error("User creation failed — no user ID returned.");
  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: newUserId, full_name, email,
    storage_limit, storage_used: 0,
    is_admin: is_admin || false, is_disabled: false,
  }, { onConflict: "id" });
  if (profileErr) throw profileErr;
  return newUserId;
}

/* ══════════════════════════════════
   STYLES
══════════════════════════════════ */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow-x:hidden}
:root{
  --teal:#00C9A7;--teal2:#00A888;--teal3:#0097B2;--tl:#7FFFD4;
  --bg:#f5f7fa;--white:#fff;--text:#111827;--muted:#6b7280;
  --border:#e5e7eb;--red:#FF6B6B;
  --admin:#6366f1;--admin2:#4f46e5;--admin-light:#eef2ff;--admin-border:#c7d2fe;
  --nunito:'Nunito',sans-serif;--dm:'DM Sans',sans-serif;
}
.cv-app{font-family:var(--dm);min-height:100%;background:var(--bg);overflow-x:hidden;max-width:480px;margin:0 auto;position:relative}

/* AUTH */
.auth-page{min-height:100svh;display:flex;flex-direction:column;background:var(--white)}
.auth-hero{background:linear-gradient(160deg,#00D4B8 0%,#00B5C8 50%,#0094B0 100%);flex:0 0 auto;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:clamp(28px,8vw,52px) clamp(20px,6vw,40px) clamp(36px,10vw,60px);min-height:clamp(240px,42svh,340px)}
.auth-hero::before{content:'';position:absolute;width:clamp(180px,65vw,320px);height:clamp(180px,65vw,320px);border-radius:50%;border:2px solid rgba(255,255,255,0.13);top:-20%;right:-15%}
.auth-hero::after{content:'';position:absolute;width:clamp(100px,40vw,200px);height:clamp(100px,40vw,200px);border-radius:50%;border:2px solid rgba(255,255,255,0.09);top:10%;right:8%}
.hero-illus{position:relative;z-index:2;width:clamp(160px,55vw,240px);height:clamp(160px,55vw,240px);flex-shrink:0}
.auth-card{background:var(--white);border-radius:clamp(20px,6vw,32px) clamp(20px,6vw,32px) 0 0;padding:clamp(22px,6vw,34px) clamp(20px,6vw,32px) clamp(28px,7vw,44px);margin-top:clamp(-22px,-5vw,-28px);flex:1;position:relative;z-index:3;box-shadow:0 -8px 32px rgba(0,0,0,0.07)}
.auth-brand{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:clamp(4px,1.5vw,8px)}
.auth-brand-icon{width:clamp(28px,8vw,36px);height:clamp(28px,8vw,36px);background:linear-gradient(135deg,var(--teal),var(--teal3));border-radius:clamp(7px,2vw,11px);display:flex;align-items:center;justify-content:center}
.auth-brand-icon svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.auth-brand-name{font-family:var(--nunito);font-size:clamp(17px,5vw,23px);font-weight:900;color:var(--text)}
.auth-brand-name span{color:var(--teal2)}
.auth-headline{font-family:var(--nunito);font-size:clamp(18px,5.2vw,25px);font-weight:800;color:var(--text);text-align:center;line-height:1.25;margin-bottom:clamp(3px,1vw,6px)}
.auth-sub{font-size:clamp(11px,3vw,13px);color:var(--muted);text-align:center;margin-bottom:clamp(18px,4.5vw,26px);line-height:1.5;padding:0 clamp(4px,2vw,16px)}
.cv-field{margin-bottom:clamp(11px,3vw,15px)}
.cv-field label{display:block;font-size:clamp(11px,3vw,12px);font-weight:600;color:var(--muted);margin-bottom:5px;padding-left:4px}
.cv-input-wrap{position:relative;display:flex;align-items:center;background:#f5f6f8;border-radius:99px;border:1.5px solid #f0f1f3;transition:border-color 0.2s,box-shadow 0.2s,background 0.2s}
.cv-input-wrap:focus-within{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,201,167,0.12);background:var(--white)}
.cv-input-wrap .fi{position:absolute;left:clamp(13px,3.8vw,17px);width:clamp(14px,3.8vw,17px);height:clamp(14px,3.8vw,17px);stroke:#b0b5be;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.cv-input{width:100%;padding:clamp(12px,3.5vw,15px) clamp(13px,3.8vw,17px) clamp(12px,3.5vw,15px) clamp(40px,10.5vw,48px);border:none;background:transparent;font-size:clamp(13px,3.4vw,14px);font-family:var(--dm);color:var(--text);outline:none;border-radius:99px}
.cv-input::placeholder{color:#b0b5be}
.cv-eye{position:absolute;right:clamp(13px,3.8vw,17px);cursor:pointer;width:clamp(14px,3.8vw,17px);height:clamp(14px,3.8vw,17px);stroke:#b0b5be;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.cv-row{display:flex;justify-content:space-between;align-items:center;margin:clamp(2px,1vw,4px) 4px clamp(16px,4.5vw,22px)}
.cv-remember{display:flex;align-items:center;gap:6px}
.cv-remember input{accent-color:var(--teal);width:14px;height:14px}
.cv-remember span,.cv-forgot{font-size:clamp(11px,3vw,13px);color:var(--muted)}
.cv-forgot{color:var(--teal2);font-weight:600;cursor:pointer}
.cv-btn{width:100%;padding:clamp(13px,3.8vw,16px);background:linear-gradient(135deg,var(--teal) 0%,var(--teal3) 100%);border:none;border-radius:99px;font-family:var(--nunito);font-size:clamp(14px,4vw,16px);font-weight:700;color:#fff;cursor:pointer;letter-spacing:0.3px;transition:opacity 0.2s,transform 0.12s;box-shadow:0 6px 22px rgba(0,180,160,0.35);display:flex;align-items:center;justify-content:center;gap:8px}
.cv-btn:hover{opacity:0.93}
.cv-btn:active{transform:scale(0.98)}
.cv-btn:disabled{opacity:0.6;cursor:not-allowed}
.auth-err{background:#fff1f2;border:1.5px solid #fecdd3;color:#e11d48;border-radius:12px;padding:clamp(10px,3vw,12px) clamp(12px,3.5vw,14px);font-size:clamp(11px,3vw,13px);font-weight:500;margin-bottom:14px;text-align:center}
.auth-success{background:#f0fdf4;border:1.5px solid #a7f3d0;color:#059669;border-radius:12px;padding:clamp(10px,3vw,12px) clamp(12px,3.5vw,14px);font-size:clamp(11px,3vw,13px);font-weight:500;margin-bottom:14px;text-align:center}

/* HOME */
.home-page{min-height:100svh;display:flex;flex-direction:column;background:var(--bg)}
.home-header{background:linear-gradient(150deg,#00D4B8 0%,#00B5C8 55%,#0094B0 100%);padding:clamp(36px,10vw,52px) clamp(18px,5vw,28px) clamp(22px,6vw,32px);position:relative;overflow:hidden}
.home-header::before{content:'';position:absolute;width:clamp(200px,70vw,320px);height:clamp(200px,70vw,320px);border-radius:50%;border:2px solid rgba(255,255,255,0.1);top:-25%;right:-15%}
.hdr-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:clamp(18px,5vw,28px);position:relative;z-index:2}
.hdr-brand{display:flex;align-items:center;gap:clamp(7px,2vw,10px)}
.hdr-brand-icon{width:clamp(32px,9vw,40px);height:clamp(32px,9vw,40px);background:rgba(255,255,255,0.2);border-radius:clamp(9px,2.5vw,13px);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.hdr-brand-icon svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hdr-brand-name{font-family:var(--nunito);font-size:clamp(15px,4.5vw,20px);font-weight:800;color:#fff}
.hdr-brand-name span{color:var(--tl)}
.hdr-notif{width:clamp(32px,9vw,40px);height:clamp(32px,9vw,40px);background:rgba(255,255,255,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;backdrop-filter:blur(4px)}
.hdr-notif svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.notif-dot{position:absolute;top:6px;right:6px;width:8px;height:8px;background:var(--red);border-radius:50%;border:1.5px solid #00B5C8}
.hdr-greet{position:relative;z-index:2;margin-bottom:clamp(16px,4.5vw,24px)}
.hdr-greet-sub{font-size:clamp(11px,3vw,13px);color:rgba(255,255,255,0.75);margin-bottom:2px}
.hdr-greet-name{font-family:var(--nunito);font-size:clamp(20px,6vw,27px);font-weight:900;color:#fff;line-height:1.2;margin-bottom:3px}
.hdr-greet-name span{color:var(--tl)}
.hdr-greet-desc{font-size:clamp(11px,3vw,13px);color:rgba(255,255,255,0.7)}
.stor-card{background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);border-radius:clamp(14px,4vw,20px);padding:clamp(13px,3.8vw,17px) clamp(13px,4vw,19px);backdrop-filter:blur(10px);position:relative;z-index:2}
.stor-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:clamp(8px,2.5vw,12px)}
.stor-lbl{font-size:clamp(9px,2.5vw,11px);color:rgba(255,255,255,0.7);font-weight:500;text-transform:uppercase;letter-spacing:0.8px}
.stor-amt{font-family:var(--nunito);font-size:clamp(11px,3vw,13px);font-weight:700;color:var(--tl)}
.stor-track{height:clamp(6px,1.8vw,8px);background:rgba(255,255,255,0.18);border-radius:99px;overflow:visible;margin-bottom:clamp(10px,3vw,13px);position:relative}
.stor-fill{height:100%;background:linear-gradient(90deg,#7FFFD4,#fff);border-radius:99px;position:relative;transition:width 0.6s ease}
.stor-fill::after{content:'';position:absolute;right:-4px;top:50%;transform:translateY(-50%);width:clamp(10px,3vw,14px);height:clamp(10px,3vw,14px);background:#fff;border-radius:50%;border:2px solid #00B5C8;box-shadow:0 2px 6px rgba(0,0,0,0.15)}
.stor-types{display:flex;gap:clamp(10px,3vw,16px);flex-wrap:wrap}
.stor-type{display:flex;align-items:center;gap:5px}
.s-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.stor-type span{font-size:clamp(10px,2.8vw,12px);color:rgba(255,255,255,0.72)}

/* BODY */
.home-body{background:var(--white);border-radius:clamp(20px,6vw,28px) clamp(20px,6vw,28px) 0 0;margin-top:clamp(-14px,-4vw,-18px);padding:clamp(18px,5vw,28px) clamp(16px,5vw,24px) clamp(90px,22vw,110px);flex:1;box-shadow:0 -6px 24px rgba(0,0,0,0.05);overflow-x:hidden}
.sheet-pill{width:34px;height:4px;background:var(--border);border-radius:99px;margin:0 auto clamp(18px,5vw,26px)}
.sec-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:clamp(12px,3.5vw,16px)}
.sec-title{font-family:var(--nunito);font-size:clamp(14px,4vw,17px);font-weight:800;color:var(--text)}
.sec-link{font-size:clamp(11px,3vw,13px);color:var(--teal2);font-weight:600;cursor:pointer}

/* QUICK ACTIONS */
.qa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2.5vw,14px);margin-bottom:clamp(22px,6vw,32px)}
.qa-btn{display:flex;flex-direction:column;align-items:center;gap:clamp(5px,1.5vw,8px);cursor:pointer;transition:transform 0.15s}
.qa-btn:active{transform:scale(0.93)}
.qa-icon{width:clamp(46px,14vw,58px);height:clamp(46px,14vw,58px);border-radius:clamp(13px,4vw,18px);display:flex;align-items:center;justify-content:center}
.qa-icon svg{width:clamp(20px,5.5vw,24px);height:clamp(20px,5.5vw,24px);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}
.qa-icon.teal{background:linear-gradient(135deg,#CFFAF4,#99F6E4)}.qa-icon.teal svg{stroke:#059669}
.qa-icon.blue{background:linear-gradient(135deg,#DBEAFE,#BFDBFE)}.qa-icon.blue svg{stroke:#1D4ED8}
.qa-icon.violet{background:linear-gradient(135deg,#EDE9FE,#DDD6FE)}.qa-icon.violet svg{stroke:#6D28D9}
.qa-icon.rose{background:linear-gradient(135deg,#FFE4E6,#FECDD3)}.qa-icon.rose svg{stroke:#BE123C}
.qa-icon.amber{background:linear-gradient(135deg,#FEF9C3,#FEF08A)}.qa-icon.amber svg{stroke:#A16207}
.qa-icon.indigo{background:linear-gradient(135deg,#E0E7FF,#C7D2FE)}.qa-icon.indigo svg{stroke:#4338CA}
.qa-label{font-size:clamp(9px,2.6vw,11px);font-weight:600;color:#374151;text-align:center;line-height:1.2}

/* FILE LIST */
.file-list{margin-bottom:clamp(22px,6vw,30px)}
.file-row{display:flex;align-items:center;gap:clamp(10px,3vw,14px);padding:clamp(10px,3vw,13px) 0;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background 0.15s;border-radius:8px}
.file-thumb{width:clamp(40px,12vw,50px);height:clamp(40px,12vw,50px);border-radius:clamp(10px,3vw,14px);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.file-thumb svg{width:clamp(18px,5vw,22px);height:clamp(18px,5vw,22px);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}
.ft-img{background:linear-gradient(135deg,#CFFAF4,#99F6E4)}.ft-img svg{stroke:#059669}
.ft-vid{background:linear-gradient(135deg,#EDE9FE,#DDD6FE)}.ft-vid svg{stroke:#6D28D9}
.ft-doc{background:linear-gradient(135deg,#FEF9C3,#FEF08A)}.ft-doc svg{stroke:#A16207}
.file-info{flex:1;min-width:0}
.file-name{font-size:clamp(12px,3.5vw,14px);font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.file-meta{font-size:clamp(10px,2.8vw,12px);color:#9ca3af}
.file-size{font-size:clamp(10px,2.8vw,12px);font-weight:600;color:#6b7280;flex-shrink:0}
.file-dots{padding:4px 6px;cursor:pointer;color:#9ca3af;font-size:16px;letter-spacing:1px;flex-shrink:0;border-radius:8px;transition:background 0.15s}
.file-dots:hover{background:#f3f4f6}

/* MEDIA GRID */
.media-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(6px,2vw,8px)}
.media-cell{aspect-ratio:1;border-radius:clamp(10px,3vw,14px);overflow:hidden;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;transition:transform 0.15s}
.media-cell:active{transform:scale(0.96)}
.media-cell svg{width:clamp(22px,6.5vw,30px);height:clamp(22px,6.5vw,30px);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;fill:none;opacity:0.45}
.media-cell img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.mc1{background:linear-gradient(135deg,#99F6E4,#5EEAD4)}.mc1 svg{stroke:#0F766E}
.mc2{background:linear-gradient(135deg,#C4B5FD,#A78BFA)}.mc2 svg{stroke:#4C1D95}
.mc3{background:linear-gradient(135deg,#FED7AA,#FDBA74)}.mc3 svg{stroke:#92400E}
.mc4{background:linear-gradient(135deg,#BAE6FD,#7DD3FC)}.mc4 svg{stroke:#075985}
.mc5{background:linear-gradient(135deg,#FECDD3,#FDA4AF)}.mc5 svg{stroke:#881337}
.mc6{background:linear-gradient(135deg,#D9F99D,#BEF264)}.mc6 svg{stroke:#3F6212}

/* BOTTOM NAV */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:var(--white);border-top:1px solid #f0f1f3;display:flex;justify-content:space-around;align-items:center;padding:clamp(8px,2.5vw,12px) 0 clamp(14px,5vw,22px);box-shadow:0 -4px 24px rgba(0,0,0,0.07);z-index:100;max-width:480px;margin:0 auto}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
.nav-icon-wrap{width:clamp(34px,9.5vw,42px);height:clamp(34px,9.5vw,42px);border-radius:clamp(10px,3vw,14px);display:flex;align-items:center;justify-content:center;transition:background 0.2s}
.nav-icon-wrap.active{background:linear-gradient(135deg,#CFFAF4,#99F6E4)}
.nav-icon-wrap.active-admin{background:linear-gradient(135deg,#E0E7FF,#C7D2FE)}
.nav-icon-wrap svg{width:clamp(16px,4.5vw,20px);height:clamp(16px,4.5vw,20px);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke:#9ca3af}
.nav-icon-wrap.active svg{stroke:#059669}
.nav-icon-wrap.active-admin svg{stroke:#4338CA}
.nav-lbl{font-size:clamp(9px,2.4vw,11px);font-weight:600;color:#9ca3af}
.nav-lbl.active{color:#059669}
.nav-lbl.active-admin{color:#4338CA}
.nav-fab{width:clamp(46px,13vw,56px);height:clamp(46px,13vw,56px);background:linear-gradient(135deg,var(--teal),var(--teal3));border-radius:clamp(13px,4vw,18px);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,180,160,0.4);margin-top:-8px;cursor:pointer;transition:transform 0.15s}
.nav-fab:active{transform:scale(0.94)}
.nav-fab svg{width:clamp(20px,5.5vw,24px);height:clamp(20px,5.5vw,24px);stroke:#fff;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}

/* MODALS */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:flex-end;backdrop-filter:blur(3px);animation:fadeIn 0.2s ease}
.sheet{background:var(--white);border-radius:clamp(20px,6vw,28px) clamp(20px,6vw,28px) 0 0;padding:clamp(20px,6vw,28px) clamp(18px,5vw,26px) clamp(28px,8vw,40px);width:100%;animation:slideUp 0.25s ease;max-height:92svh;overflow-y:auto}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sheet-handle{width:34px;height:4px;background:var(--border);border-radius:99px;margin:0 auto clamp(16px,4.5vw,22px)}
.sheet-title{font-family:var(--nunito);font-size:clamp(16px,4.5vw,20px);font-weight:800;color:var(--text);margin-bottom:clamp(14px,4vw,20px)}

/* UPLOAD */
.upload-opts{display:grid;grid-template-columns:1fr 1fr;gap:clamp(10px,3vw,14px)}
.upload-opt{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,2.5vw,11px);padding:clamp(14px,4vw,20px) clamp(10px,3vw,16px);border-radius:clamp(14px,4vw,18px);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;border:1.5px solid var(--border)}
.upload-opt:active{transform:scale(0.96)}
.upload-opt-icon{width:clamp(44px,12vw,54px);height:clamp(44px,12vw,54px);border-radius:clamp(12px,3.5vw,16px);display:flex;align-items:center;justify-content:center}
.upload-opt-icon svg{width:55%;height:55%;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}
.upload-opt-label{font-size:clamp(12px,3.2vw,14px);font-weight:600;color:var(--text)}
.upload-opt-sub{font-size:clamp(10px,2.8vw,11px);color:var(--muted);text-align:center}

/* MULTI-UPLOAD QUEUE */
.queue-list{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.queue-item{display:flex;align-items:center;gap:10px;background:#f9fafb;border-radius:12px;padding:10px 12px}
.queue-item-name{flex:1;font-size:clamp(11px,3vw,13px);font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.queue-item-size{font-size:11px;color:var(--muted);flex-shrink:0}
.queue-item-status{flex-shrink:0;font-size:16px}
.queue-remove{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#e11d48;font-size:14px;font-weight:700;line-height:1}
.upload-all-btn{width:100%;padding:clamp(13px,3.8vw,16px);background:linear-gradient(135deg,var(--teal) 0%,var(--teal3) 100%);border:none;border-radius:99px;font-family:var(--nunito);font-size:clamp(14px,4vw,16px);font-weight:700;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 22px rgba(0,180,160,0.35);margin-top:12px}
.upload-all-btn:disabled{opacity:0.6;cursor:not-allowed}

/* PROGRESS */
.prog-bar-wrap{background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:clamp(12px,3.5vw,16px);padding:clamp(12px,3.5vw,16px) clamp(14px,4vw,18px);margin-bottom:clamp(14px,4vw,18px)}
.prog-bar-label{font-size:clamp(12px,3.2vw,13px);font-weight:600;color:#059669;margin-bottom:8px;display:flex;justify-content:space-between}
.prog-bar-track{height:7px;background:#dcfce7;border-radius:99px;overflow:hidden}
.prog-bar-fill{height:100%;background:linear-gradient(90deg,var(--teal),var(--teal3));border-radius:99px;transition:width 0.3s ease}

/* FILE VIEWER */
.viewer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,5vw,28px);animation:fadeIn 0.2s ease}
.viewer-header{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:clamp(14px,4vw,20px) clamp(16px,5vw,24px);background:linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)}
.viewer-title{color:#fff;font-family:var(--nunito);font-size:clamp(13px,3.8vw,16px);font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}
.viewer-close{width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;flex-shrink:0}
.viewer-close svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round}
.viewer-img{max-width:100%;max-height:70svh;border-radius:12px;object-fit:contain}
.viewer-video{max-width:100%;max-height:70svh;border-radius:12px}
.viewer-doc{background:var(--white);border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center}
.viewer-doc-icon{width:64px;height:64px;background:linear-gradient(135deg,#FEF9C3,#FEF08A);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.viewer-doc-icon svg{width:32px;height:32px;stroke:#A16207;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.viewer-doc-name{font-family:var(--nunito);font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px;word-break:break-all}
.viewer-doc-size{font-size:13px;color:var(--muted);margin-bottom:20px}
.viewer-footer{position:absolute;bottom:0;left:0;right:0;padding:clamp(14px,4vw,20px) clamp(16px,5vw,24px);background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);display:flex;gap:12px}
.viewer-btn{flex:1;padding:clamp(11px,3.2vw,14px);border-radius:99px;border:none;font-family:var(--nunito);font-size:clamp(13px,3.5vw,15px);font-weight:700;cursor:pointer;transition:opacity 0.2s}
.viewer-btn.primary{background:linear-gradient(135deg,var(--teal),var(--teal3));color:#fff;box-shadow:0 4px 16px rgba(0,180,160,0.4)}
.viewer-btn.secondary{background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);backdrop-filter:blur(6px)}

/* FILE OPTIONS */
.opt-list{display:flex;flex-direction:column;gap:4px}
.opt-row{display:flex;align-items:center;gap:14px;padding:clamp(12px,3.5vw,15px) clamp(8px,2.5vw,12px);border-radius:clamp(12px,3.5vw,16px);cursor:pointer;transition:background 0.15s}
.opt-row:hover{background:#f9fafb}
.opt-icon{width:clamp(38px,11vw,46px);height:clamp(38px,11vw,46px);border-radius:clamp(11px,3.2vw,14px);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.opt-icon svg{width:55%;height:55%;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}
.opt-info{flex:1}
.opt-title{font-size:clamp(13px,3.6vw,15px);font-weight:600;color:var(--text)}
.opt-sub{font-size:clamp(10px,2.8vw,12px);color:var(--muted);margin-top:1px}
.opt-row.danger .opt-title{color:#e11d48}

/* SEARCH / FILTER */
.filter-row{display:flex;gap:clamp(8px,2.5vw,12px);overflow-x:auto;padding-bottom:4px;margin-bottom:clamp(14px,4vw,20px);scrollbar-width:none}
.filter-row::-webkit-scrollbar{display:none}
.filter-chip{flex-shrink:0;padding:clamp(6px,2vw,8px) clamp(12px,3.5vw,16px);border-radius:99px;font-size:clamp(11px,3vw,13px);font-weight:600;cursor:pointer;transition:all 0.15s;border:1.5px solid var(--border);background:var(--white);color:var(--muted)}
.filter-chip.active{background:var(--teal);border-color:var(--teal);color:#fff;box-shadow:0 3px 10px rgba(0,180,160,0.3)}
.filter-chip.active-admin{background:var(--admin);border-color:var(--admin);color:#fff;box-shadow:0 3px 10px rgba(99,102,241,0.3)}
.search-wrap{display:flex;align-items:center;gap:clamp(10px,3vw,14px);margin-bottom:clamp(16px,4.5vw,22px)}
.search-bar{flex:1;display:flex;align-items:center;gap:clamp(8px,2.5vw,11px);background:#f5f6f8;border-radius:99px;padding:clamp(10px,3vw,13px) clamp(14px,4vw,18px);border:1.5px solid var(--border)}
.search-bar svg{width:clamp(14px,4vw,16px);height:clamp(14px,4vw,16px);stroke:#9ca3af;fill:none;stroke-width:2;stroke-linecap:round;flex-shrink:0}
.search-bar input{border:none;background:transparent;outline:none;font-size:clamp(12px,3.4vw,14px);font-family:var(--dm);color:var(--text);width:100%}
.search-bar input::placeholder{color:#b0b5be}
.sort-btn{width:clamp(38px,10.5vw,46px);height:clamp(38px,10.5vw,46px);background:#f5f6f8;border-radius:clamp(11px,3vw,14px);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;border:1.5px solid var(--border)}
.sort-btn svg{width:55%;height:55%;stroke:#6b7280;fill:none;stroke-width:2;stroke-linecap:round}

/* PROFILE */
.prof-page{padding-bottom:clamp(90px,22vw,110px)}
.prof-hdr{background:linear-gradient(150deg,#00D4B8 0%,#00B5C8 55%,#0094B0 100%);padding:clamp(36px,10vw,52px) clamp(18px,5vw,28px) clamp(30px,8vw,44px);text-align:center;position:relative}
.prof-avatar{width:clamp(64px,18vw,82px);height:clamp(64px,18vw,82px);background:rgba(255,255,255,0.22);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto clamp(10px,3vw,14px);border:2.5px solid rgba(255,255,255,0.5)}
.prof-avatar svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.prof-avatar-initials{font-family:var(--nunito);font-size:clamp(20px,6vw,28px);font-weight:900;color:#fff;line-height:1}
.prof-name{font-family:var(--nunito);font-size:clamp(18px,5.5vw,24px);font-weight:900;color:#fff;margin-bottom:4px}
.prof-email{font-size:clamp(11px,3vw,13px);color:rgba(255,255,255,0.75)}
.prof-body{background:var(--white);border-radius:clamp(20px,6vw,28px) clamp(20px,6vw,28px) 0 0;margin-top:clamp(-14px,-4vw,-18px);padding:clamp(20px,5.5vw,28px) clamp(16px,5vw,24px)}
.prof-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(10px,3vw,14px);margin-bottom:clamp(22px,6vw,30px)}
.prof-stat{background:#f9fafb;border-radius:clamp(12px,3.5vw,16px);padding:clamp(12px,3.5vw,16px) clamp(8px,2.5vw,12px);text-align:center}
.pstat-val{font-family:var(--nunito);font-size:clamp(15px,4.5vw,21px);font-weight:900;color:var(--text)}
.pstat-lbl{font-size:clamp(9px,2.5vw,11px);color:var(--muted);margin-top:2px}
.menu-list{display:flex;flex-direction:column;gap:clamp(2px,0.8vw,4px)}
.menu-row{display:flex;align-items:center;gap:clamp(12px,3.5vw,16px);padding:clamp(13px,3.8vw,16px) clamp(8px,2.5vw,12px);border-radius:clamp(12px,3.5vw,16px);cursor:pointer;transition:background 0.15s}
.menu-row:hover{background:#f9fafb}
.menu-row-icon{width:clamp(36px,10vw,44px);height:clamp(36px,10vw,44px);border-radius:clamp(10px,3vw,13px);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.menu-row-icon svg{width:55%;height:55%;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none}
.menu-row-info{flex:1}
.menu-row-title{font-size:clamp(13px,3.6vw,15px);font-weight:600;color:var(--text)}
.menu-row-sub{font-size:clamp(10px,2.8vw,12px);color:var(--muted);margin-top:1px}
.menu-row-arrow{color:#d1d5db;font-size:18px}
.logout-row{margin-top:clamp(16px,4.5vw,22px)}
.logout-btn{width:100%;padding:clamp(13px,3.8vw,15px);background:#fff1f2;border:1.5px solid #fecdd3;border-radius:99px;font-family:var(--nunito);font-size:clamp(13px,3.8vw,15px);font-weight:700;color:#e11d48;cursor:pointer;transition:opacity 0.2s,transform 0.12s}
.logout-btn:active{transform:scale(0.98)}

/* LOGOUT CONFIRM */
.logout-confirm-icon{width:clamp(52px,14vw,64px);height:clamp(52px,14vw,64px);background:#fff1f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto clamp(12px,3.5vw,16px)}
.logout-confirm-icon svg{width:48%;height:48%;stroke:#e11d48;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.logout-confirm-title{font-family:var(--nunito);font-size:clamp(17px,5vw,21px);font-weight:800;color:var(--text);text-align:center;margin-bottom:6px}
.logout-confirm-sub{font-size:clamp(12px,3.2vw,13px);color:var(--muted);text-align:center;line-height:1.5;margin-bottom:clamp(20px,5.5vw,28px)}
.logout-confirm-btns{display:flex;gap:clamp(10px,3vw,14px)}
.logout-cancel-btn{flex:1;padding:clamp(13px,3.8vw,15px);background:#f5f6f8;border:1.5px solid var(--border);border-radius:99px;font-family:var(--nunito);font-size:clamp(13px,3.8vw,15px);font-weight:700;color:var(--text);cursor:pointer;transition:opacity 0.2s,transform 0.12s}
.logout-cancel-btn:active{transform:scale(0.98)}
.logout-confirm-btn{flex:1;padding:clamp(13px,3.8vw,15px);background:linear-gradient(135deg,#FF6B6B,#e11d48);border:none;border-radius:99px;font-family:var(--nunito);font-size:clamp(13px,3.8vw,15px);font-weight:700;color:#fff;cursor:pointer;transition:opacity 0.2s,transform 0.12s;box-shadow:0 6px 18px rgba(225,29,72,0.3)}
.logout-confirm-btn:active{transform:scale(0.98)}
.logout-confirm-btn:disabled{opacity:0.6;cursor:not-allowed}

/* TOAST */
.toast{position:fixed;bottom:clamp(76px,18vw,90px);left:50%;transform:translateX(-50%);background:#111827;color:#fff;font-size:clamp(12px,3.2vw,13px);font-weight:600;padding:clamp(9px,2.5vw,11px) clamp(16px,4.5vw,22px);border-radius:99px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:999;white-space:nowrap;animation:fadeIn 0.2s ease;max-width:90vw;text-overflow:ellipsis;overflow:hidden}

/* EMPTY */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(28px,8vw,44px) 16px;text-align:center}
.empty-icon{width:clamp(56px,16vw,72px);height:clamp(56px,16vw,72px);background:#f9fafb;border-radius:clamp(16px,5vw,22px);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.empty-icon svg{width:55%;height:55%;stroke:#d1d5db;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.empty h3{font-family:var(--nunito);font-size:clamp(15px,4.5vw,18px);font-weight:800;color:var(--text);margin-bottom:6px}
.empty p{font-size:clamp(12px,3.2vw,13px);color:var(--muted);line-height:1.5}

/* LOADER */
.spin{width:20px;height:20px;border:2.5px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
.spin-teal{border-color:rgba(0,201,167,0.2);border-top-color:var(--teal)}
.spin-admin{border-color:rgba(99,102,241,0.2);border-top-color:var(--admin)}
@keyframes spin{to{transform:rotate(360deg)}}
.page-loader{display:flex;align-items:center;justify-content:center;min-height:100svh;background:var(--white)}
.page-loader-inner{display:flex;flex-direction:column;align-items:center;gap:16px}
.page-loader-inner span{font-family:var(--nunito);font-size:15px;font-weight:700;color:var(--teal2)}

/* ADMIN */
.admin-page{min-height:100svh;display:flex;flex-direction:column;background:var(--bg);padding-bottom:clamp(90px,22vw,110px)}
.admin-hdr{background:linear-gradient(150deg,#6366f1 0%,#4f46e5 55%,#4338ca 100%);padding:clamp(36px,10vw,52px) clamp(18px,5vw,28px) clamp(28px,7vw,38px);position:relative;overflow:hidden}
.admin-hdr::before{content:'';position:absolute;width:clamp(180px,65vw,300px);height:clamp(180px,65vw,300px);border-radius:50%;border:2px solid rgba(255,255,255,0.1);top:-20%;right:-10%}
.admin-hdr::after{content:'';position:absolute;width:clamp(100px,38vw,180px);height:clamp(100px,38vw,180px);border-radius:50%;border:2px solid rgba(255,255,255,0.07);bottom:-10%;left:-5%}
.admin-hdr-row{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2;margin-bottom:clamp(14px,4vw,20px)}
.admin-badge{display:flex;align-items:center;gap:8px}
.admin-badge-icon{width:clamp(32px,9vw,40px);height:clamp(32px,9vw,40px);background:rgba(255,255,255,0.2);border-radius:clamp(9px,2.5vw,13px);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.admin-badge-icon svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.admin-badge-label{font-family:var(--nunito);font-size:clamp(14px,4vw,18px);font-weight:800;color:#fff}
.admin-badge-sub{font-size:clamp(10px,2.5vw,12px);color:rgba(255,255,255,0.65)}
.admin-logout-btn{width:clamp(32px,9vw,38px);height:clamp(32px,9vw,38px);background:rgba(255,255,255,0.15);border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer}
.admin-logout-btn svg{width:55%;height:55%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,2.5vw,12px);position:relative;z-index:2}
.admin-stat{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:clamp(12px,3.5vw,16px);padding:clamp(10px,3vw,14px) clamp(8px,2.5vw,12px);text-align:center;backdrop-filter:blur(8px)}
.astat-val{font-family:var(--nunito);font-size:clamp(16px,5vw,22px);font-weight:900;color:#fff}
.astat-lbl{font-size:clamp(9px,2.4vw,11px);color:rgba(255,255,255,0.7);margin-top:2px}
.admin-body{background:var(--white);border-radius:clamp(20px,6vw,28px) clamp(20px,6vw,28px) 0 0;margin-top:clamp(-14px,-4vw,-18px);padding:clamp(18px,5vw,26px) clamp(16px,5vw,24px);flex:1;box-shadow:0 -6px 24px rgba(0,0,0,0.05)}
.admin-tabs{display:flex;gap:8px;background:#f5f6f8;border-radius:14px;padding:4px;margin-bottom:clamp(16px,4.5vw,22px)}
.admin-tab{flex:1;padding:clamp(8px,2.5vw,10px) 8px;border-radius:11px;border:none;background:transparent;font-family:var(--nunito);font-size:clamp(12px,3.2vw,13px);font-weight:700;color:var(--muted);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px}
.admin-tab.active{background:var(--white);color:var(--admin);box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.admin-tab svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.user-card{background:#fafafa;border:1.5px solid var(--border);border-radius:clamp(14px,4vw,18px);padding:clamp(12px,3.5vw,16px);margin-bottom:clamp(10px,3vw,12px);transition:border-color 0.2s}
.user-card.disabled-user{opacity:0.55;background:#f9fafb}
.user-card-top{display:flex;align-items:center;gap:clamp(10px,3vw,13px);margin-bottom:10px}
.user-avatar{width:clamp(38px,11vw,46px);height:clamp(38px,11vw,46px);border-radius:50%;background:linear-gradient(135deg,var(--admin-light),var(--admin-border));display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--nunito);font-size:clamp(14px,4vw,17px);font-weight:800;color:var(--admin)}
.user-info{flex:1;min-width:0}
.user-name{font-size:clamp(13px,3.6vw,14px);font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-email{font-size:clamp(10px,2.8vw,12px);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:clamp(9px,2.4vw,10px);font-weight:700}
.badge-admin{background:var(--admin-light);color:var(--admin)}
.badge-disabled{background:#fee2e2;color:#e11d48}
.badge-active{background:#dcfce7;color:#059669}
.user-card-meta{display:flex;gap:clamp(10px,3vw,14px);flex-wrap:wrap;margin-bottom:12px}
.user-meta-item{font-size:clamp(10px,2.8vw,12px);color:var(--muted);display:flex;align-items:center;gap:4px}
.user-meta-item svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.user-stor-bar{height:4px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-bottom:12px}
.user-stor-fill{height:100%;background:linear-gradient(90deg,var(--admin),#818cf8);border-radius:99px}
.user-actions{display:flex;gap:clamp(6px,2vw,8px)}
.ua-btn{flex:1;padding:clamp(7px,2.2vw,9px) 6px;border-radius:99px;font-size:clamp(10px,2.8vw,12px);font-weight:700;font-family:var(--nunito);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;border:1.5px solid transparent;transition:all 0.15s}
.ua-btn:active{transform:scale(0.96)}
.ua-btn.edit{background:var(--admin-light);color:var(--admin);border-color:var(--admin-border)}
.ua-btn.disable{background:#fef9c3;color:#a16207;border-color:#fde68a}
.ua-btn.enable{background:#dcfce7;color:#059669;border-color:#a7f3d0}
.ua-btn.del{background:#fff1f2;color:#e11d48;border-color:#fecdd3}
.ua-btn svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.admin-file-row{display:flex;align-items:center;gap:clamp(10px,3vw,13px);padding:clamp(10px,3vw,13px) 0;border-bottom:1px solid #f3f4f6}
.admin-file-row:last-child{border-bottom:none}
.admin-file-owner{font-size:clamp(9px,2.4vw,11px);color:var(--admin);font-weight:600;margin-top:2px}
.admin-del-btn{width:clamp(30px,9vw,36px);height:clamp(30px,9vw,36px);border-radius:clamp(8px,2.5vw,10px);background:#fff1f2;border:1.5px solid #fecdd3;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background 0.15s}
.admin-del-btn:hover{background:#fee2e2}
.admin-del-btn svg{width:14px;height:14px;stroke:#e11d48;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* FORM FIELDS */
.form-field{margin-bottom:clamp(12px,3.5vw,16px)}
.form-field label{display:block;font-size:clamp(11px,3vw,12px);font-weight:600;color:var(--muted);margin-bottom:5px;padding-left:2px}
.form-input{width:100%;padding:clamp(11px,3.2vw,13px) clamp(13px,3.8vw,15px);border:1.5px solid var(--border);border-radius:12px;font-size:clamp(13px,3.4vw,14px);font-family:var(--dm);color:var(--text);background:#f9fafb;outline:none;transition:border-color 0.2s,box-shadow 0.2s}
.form-input:focus{border-color:var(--admin);box-shadow:0 0 0 3px rgba(99,102,241,0.12);background:var(--white)}
.form-input.teal-focus:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,201,167,0.12)}
.form-id-box{width:100%;padding:clamp(10px,3vw,12px) clamp(13px,3.8vw,15px);border:1.5px dashed var(--border);border-radius:12px;font-size:clamp(10px,2.6vw,12px);font-family:monospace;color:var(--muted);background:#f9fafb;word-break:break-all;line-height:1.5;display:flex;align-items:center;justify-content:space-between;gap:8px}
.form-id-box span{flex:1;word-break:break-all}
.copy-id-btn{flex-shrink:0;padding:4px 10px;background:var(--admin-light);color:var(--admin);border:1px solid var(--admin-border);border-radius:8px;font-size:11px;font-weight:700;font-family:var(--nunito);cursor:pointer;white-space:nowrap}
.form-input-wrap{position:relative;display:flex;align-items:center}
.form-input-wrap .form-input{padding-right:44px}
.form-eye{position:absolute;right:14px;cursor:pointer;width:16px;height:16px;stroke:#b0b5be;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.form-toggle{display:flex;align-items:center;justify-content:space-between;padding:clamp(11px,3.2vw,13px) clamp(13px,3.8vw,15px);border:1.5px solid var(--border);border-radius:12px;background:#f9fafb;cursor:pointer}
.form-toggle-label{font-size:clamp(13px,3.4vw,14px);color:var(--text);font-weight:500}
.toggle-switch{width:42px;height:24px;border-radius:99px;background:#e5e7eb;position:relative;transition:background 0.2s;flex-shrink:0}
.toggle-switch.on{background:var(--admin)}
.toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.2)}
.toggle-switch.on .toggle-knob{left:21px}
.admin-btn{width:100%;padding:clamp(13px,3.8vw,15px);background:linear-gradient(135deg,var(--admin),var(--admin2));border:none;border-radius:99px;font-family:var(--nunito);font-size:clamp(14px,4vw,15px);font-weight:700;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 20px rgba(99,102,241,0.35);transition:opacity 0.2s,transform 0.12s;margin-top:4px}
.admin-btn:hover{opacity:0.92}
.admin-btn:active{transform:scale(0.98)}
.admin-btn:disabled{opacity:0.6;cursor:not-allowed}
.admin-err{background:#fff1f2;border:1.5px solid #fecdd3;color:#e11d48;border-radius:12px;padding:10px 14px;font-size:clamp(11px,3vw,13px);font-weight:500;margin-bottom:14px;text-align:center}
.admin-success{background:#f0fdf4;border:1.5px solid #a7f3d0;color:#059669;border-radius:12px;padding:10px 14px;font-size:clamp(11px,3vw,13px);font-weight:500;margin-bottom:14px;text-align:center}
.confirm-danger-btn{width:100%;padding:clamp(13px,3.8vw,15px);background:linear-gradient(135deg,#FF6B6B,#e11d48);border:none;border-radius:99px;font-family:var(--nunito);font-size:clamp(14px,4vw,15px);font-weight:700;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 18px rgba(225,29,72,0.3);margin-top:4px}
.confirm-danger-btn:disabled{opacity:0.6;cursor:not-allowed}
.pw-strength{margin-top:6px;display:flex;gap:4px;align-items:center}
.pw-bar{flex:1;height:3px;border-radius:99px;background:#e5e7eb;transition:background 0.3s}
.pw-label{font-size:10px;color:var(--muted);white-space:nowrap}

/* INFO BOX */
.info-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px 14px;font-size:clamp(11px,3vw,12px);color:#1d4ed8;line-height:1.6;margin-bottom:14px}
.info-box strong{font-weight:700}
.info-box-warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
`;

/* ── ICONS ── */
const CloudIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
);
const FileThumb = ({ type }) => {
  if (type === "img") return <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
  if (type === "vid") return <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  return <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
};

/* ════════════════════════════════
   SHARED COMPONENTS
════════════════════════════════ */

function LogoutConfirm({ onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    try { await onConfirm(); } catch {}
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="logout-confirm-icon">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <p className="logout-confirm-title">Log out?</p>
        <p className="logout-confirm-sub">You'll need to sign in again to access your files and storage.</p>
        <div className="logout-confirm-btns">
          <button className="logout-cancel-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="logout-confirm-btn" onClick={handleConfirm} disabled={busy}>
            {busy ? <span className="spin" style={{width:16,height:16,borderWidth:2}}/> : "Yes, log out"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmSheet({ title, sub, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => { setBusy(true); await onConfirm(); setBusy(false); };
  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="logout-confirm-icon"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></div>
        <p className="logout-confirm-title">{title}</p>
        <p className="logout-confirm-sub">{sub}</p>
        <div className="logout-confirm-btns">
          <button className="logout-cancel-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="confirm-danger-btn" onClick={handle} disabled={busy}>
            {busy ? <span className="spin" style={{width:16,height:16,borderWidth:2}}/> : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   AUTH PAGE
════════════════════════════════ */
function AuthPage({ onAuth }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [show, setShow]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState("");

  const handle = async () => {
    setErr("");
    if (!email || !pass) { setErr("Please enter your email and password."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      const user = data.user;
      // Check if account is disabled
      const profile = await fetchProfile(user.id);
      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        throw new Error("Your account has been disabled. Please contact your administrator.");
      }
      // Check if profile exists (deleted profile = blocked)
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error("Account not found. Please contact your administrator.");
      }
      onAuth(user);
    } catch (e) {
      setErr(e.message || "Invalid email or password.");
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="hero-illus">
          <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="120" cy="185" rx="80" ry="14" fill="rgba(0,0,0,0.1)"/>
            <rect x="45" y="45" width="120" height="150" rx="13" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <rect x="60" y="66" width="46" height="5" rx="2.5" fill="rgba(255,255,255,0.6)"/>
            <rect x="60" y="78" width="74" height="5" rx="2.5" fill="rgba(255,255,255,0.4)"/>
            <rect x="60" y="108" width="92" height="50" rx="7" fill="rgba(255,255,255,0.12)"/>
            <rect x="70" y="138" width="13" height="14" rx="3" fill="rgba(127,255,212,0.7)"/>
            <rect x="89" y="126" width="13" height="26" rx="3" fill="rgba(127,255,212,0.85)"/>
            <rect x="108" y="133" width="13" height="19" rx="3" fill="rgba(127,255,212,0.65)"/>
            <rect x="127" y="120" width="13" height="32" rx="3" fill="#7FFFD4"/>
            <circle cx="24" cy="108" r="11" fill="rgba(255,255,255,0.28)"/>
            <circle cx="24" cy="102" r="4.5" fill="rgba(255,255,255,0.6)"/>
            <path d="M15 118 Q24 111 33 118" fill="rgba(255,255,255,0.4)"/>
          </svg>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon"><CloudIcon/></div>
          <span className="auth-brand-name">Zharm<span>Vault</span></span>
        </div>
        <h2 className="auth-headline">Welcome Back 👋</h2>
        <p className="auth-sub">Sign in with your credentials to access your files and storage.</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="cv-field">
          <label>Email Address</label>
          <div className="cv-input-wrap">
            <svg className="fi" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <input className="cv-input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()}/>
          </div>
        </div>
        <div className="cv-field">
          <label>Password</label>
          <div className="cv-input-wrap">
            <svg className="fi" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input className="cv-input" type={show?"text":"password"} placeholder="Enter your password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()}/>
            <svg className="cv-eye" viewBox="0 0 24 24" onClick={() => setShow(!show)}>
              {show ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
            </svg>
          </div>
        </div>
        <div className="cv-row">
          <label className="cv-remember"><input type="checkbox"/><span>Remember Me</span></label>
        </div>
        <button className="cv-btn" onClick={handle} disabled={busy}>
          {busy ? <><span className="spin"/>Signing in…</> : "Sign In →"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   FILE VIEWER
════════════════════════════════ */
function FileViewer({ record, onClose, onDownload }) {
  const [url, setUrl]   = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState("");
  useEffect(() => { getFileUrl(record).then(u => setUrl(u)).catch(e => setErr(e.message)).finally(() => setBusy(false)); }, [record]);
  const type = getFileType(record.category);
  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-header" onClick={e => e.stopPropagation()}>
        <span className="viewer-title">{record.original_name}</span>
        <button className="viewer-close" onClick={onClose}><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div onClick={e => e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"70svh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {busy && <div className="spin" style={{width:36,height:36,borderWidth:3}}/>}
        {err  && <p style={{color:"#fca5a5",fontSize:13,textAlign:"center"}}>{err}</p>}
        {!busy && !err && url && (
          <>
            {type==="img" && <img src={url} alt={record.original_name} className="viewer-img"/>}
            {type==="vid" && <video src={url} className="viewer-video" controls autoPlay playsInline/>}
            {type==="doc" && (
              <div className="viewer-doc">
                <div className="viewer-doc-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <p className="viewer-doc-name">{record.original_name}</p>
                <p className="viewer-doc-size">{formatSize(record.size)}</p>
                <button className="cv-btn" onClick={() => window.open(url,"_blank")} style={{marginBottom:0}}>Open in Browser</button>
              </div>
            )}
          </>
        )}
      </div>
      {!busy && !err && (
        <div className="viewer-footer" onClick={e => e.stopPropagation()}>
          <button className="viewer-btn secondary" onClick={onClose}>Close</button>
          <button className="viewer-btn primary" onClick={() => { onDownload(record); onClose(); }}>↓ Download</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════
   FILE OPTIONS SHEET
════════════════════════════════ */
function FileOptions({ record, onClose, onView, onDownload, onDelete }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p style={{fontSize:"clamp(13px,3.6vw,15px)",marginBottom:6,fontWeight:700,wordBreak:"break-all",fontFamily:"var(--nunito)",color:"var(--text)"}}>{record.original_name}</p>
        <p style={{fontSize:"clamp(10px,2.8vw,12px)",color:"var(--muted)",marginBottom:16}}>{formatSize(record.size)} · {timeAgo(record.created_at)}</p>
        <div className="opt-list">
          {[
            { label:"View File",   sub:"Preview in app",    color:"teal",   icon:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,  fn: onView },
            { label:"Download",    sub:"Save to device",    color:"blue",   icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, fn: () => { onDownload(record); onClose(); } },
            { label:"Share Link",  sub:"Copy shareable URL",color:"violet", icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>, fn: async () => { try { const url = await getFileUrl(record); await navigator.clipboard.writeText(url); } catch {} onClose(); } },
            { label:"Delete File", sub:"Remove permanently",color:"rose",   icon:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>, fn: onDelete, danger: true },
          ].map((o,i) => (
            <div className={`opt-row ${o.danger?"danger":""}`} key={i} onClick={o.fn}>
              <div className={`opt-icon qa-icon ${o.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{o.icon}</svg></div>
              <div className="opt-info"><p className="opt-title">{o.label}</p><p className="opt-sub">{o.sub}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   UPLOAD SHEET
════════════════════════════════ */
function UploadSheet({ onClose, userId, onUploaded, showToast }) {
  const [queue, setQueue]       = useState([]);
  const [busy, setBusy]         = useState(false);
  const [current, setCurrent]   = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const imgRef = useRef(null);
  const vidRef = useRef(null);
  const docRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList);
    setQueue(prev => {
      const existing = new Set(prev.map(q => q.file.name + q.file.size));
      const newOnes = incoming.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...newOnes.map(f => ({ file: f, status: "pending" }))];
    });
  };
  const removeFromQueue = (idx) => setQueue(prev => prev.filter((_, i) => i !== idx));

  const uploadAll = async () => {
    if (queue.length === 0) return;
    setBusy(true); setDoneCount(0);
    let done = 0;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === "done") { done++; continue; }
      setCurrent(item.file.name);
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "uploading" } : q));
      try {
        await uploadFile(item.file, userId);
        done++; setDoneCount(done);
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "done" } : q));
      } catch (e) {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "error", error: e.message } : q));
      }
    }
    setBusy(false); setCurrent("");
    showToast(`✅ ${done} file${done !== 1 ? "s" : ""} uploaded!`);
    onUploaded(); setTimeout(() => onClose(), 700);
  };

  const pendingCount = queue.filter(q => q.status === "pending" || q.status === "error").length;
  const totalCount   = queue.length;
  const statusIcon = (s) => {
    if (s === "pending")   return <span style={{color:"#9ca3af"}}>○</span>;
    if (s === "uploading") return <span className="spin spin-teal" style={{width:14,height:14,borderWidth:2}}/>;
    if (s === "done")      return <span style={{color:"#059669"}}>✓</span>;
    return <span style={{color:"#e11d48"}}>✕</span>;
  };

  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">Upload Files</p>
        {!busy && (
          <div className="upload-opts" style={{marginBottom: queue.length ? 16 : 0}}>
            {[
              { label:"Images", sub:"Select multiple", color:"teal", accept:"image/*", ref:imgRef, icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
              { label:"Videos", sub:"Select multiple", color:"violet", accept:"video/*", ref:vidRef, icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
              { label:"Documents", sub:"PDF, DOC, ZIP…", color:"blue", accept:".pdf,.doc,.docx,.txt,.xlsx,.pptx,.zip", ref:docRef, icon:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
              { label:"Any File", sub:"All types", color:"rose", accept:"*", ref:null, icon:<><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></> },
            ].map((o, i) => (
              <div key={i} className="upload-opt" onClick={() => {
                if (o.ref) { o.ref.current.click(); return; }
                const inp = document.createElement("input");
                inp.type = "file"; inp.accept = o.accept; inp.multiple = true;
                inp.onchange = e => addFiles(e.target.files); inp.click();
              }}>
                {o.ref && <input ref={o.ref} type="file" accept={o.accept} multiple style={{display:"none"}} onChange={e => addFiles(e.target.files)}/>}
                <div className={`upload-opt-icon qa-icon ${o.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{o.icon}</svg></div>
                <span className="upload-opt-label">{o.label}</span>
                <span className="upload-opt-sub">{o.sub}</span>
              </div>
            ))}
          </div>
        )}
        {queue.length > 0 && (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:"clamp(12px,3vw,13px)",fontWeight:700,color:"var(--text)"}}>{totalCount} file{totalCount !== 1?"s":""} selected</span>
              {!busy && <span style={{fontSize:12,color:"var(--teal2)",fontWeight:600,cursor:"pointer"}} onClick={() => setQueue([])}>Clear all</span>}
            </div>
            {busy && current && (
              <div className="prog-bar-wrap" style={{marginBottom:12}}>
                <div className="prog-bar-label">
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{current}</span>
                  <span>{doneCount}/{totalCount}</span>
                </div>
                <div className="prog-bar-track"><div className="prog-bar-fill" style={{width:`${Math.round((doneCount/totalCount)*100)}%`}}/></div>
              </div>
            )}
            <div className="queue-list">
              {queue.map((item, i) => (
                <div className="queue-item" key={i}>
                  <span className="queue-item-status">{statusIcon(item.status)}</span>
                  <span className="queue-item-name">{item.file.name}</span>
                  <span className="queue-item-size">{formatSize(item.file.size)}</span>
                  {!busy && item.status !== "done" && <button className="queue-remove" onClick={() => removeFromQueue(i)}>×</button>}
                </div>
              ))}
            </div>
            {!busy && pendingCount > 0 && (
              <button className="upload-all-btn" onClick={uploadAll}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload {pendingCount} file{pendingCount !== 1?"s":""}
              </button>
            )}
          </>
        )}
        {queue.length === 0 && <p style={{textAlign:"center",fontSize:"clamp(11px,3vw,13px)",color:"var(--muted)",marginTop:8}}>Select files above to add them to the queue</p>}
      </div>
    </div>
  );
}

/* ════════════════════════════════
   IMAGE THUMB
════════════════════════════════ */
function ImageThumb({ record }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (record.bucket === "images") {
      const { data } = supabase.storage.from("images").getPublicUrl(record.storage_path);
      setUrl(data.publicUrl);
    }
  }, [record]);
  return url
    ? <img src={url} alt={record.original_name} loading="lazy"/>
    : <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}

/* ════════════════════════════════
   PROFILE MODALS
════════════════════════════════ */

// Edit Profile Sheet
function EditProfileSheet({ profile, user, onClose, onSaved, showToast }) {
  const [name, setName] = useState(profile?.full_name || "");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const handleSave = async () => {
    setErr("");
    if (!name.trim()) { setErr("Name cannot be empty."); return; }
    setBusy(true);
    try {
      await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
      showToast("✅ Profile updated!");
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">Edit Profile</p>
        {err && <div className="admin-err">{err}</div>}
        <div className="form-field">
          <label>Full Name</label>
          <input className="form-input teal-focus" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"/>
        </div>
        <div className="form-field">
          <label>Email Address</label>
          <div className="form-id-box" style={{borderStyle:"solid",background:"#f3f4f6"}}>
            <span style={{fontSize:"clamp(12px,3vw,13px)",fontFamily:"var(--dm)",color:"var(--text)"}}>{user?.email}</span>
            <span style={{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap"}}>Read-only</span>
          </div>
          <p style={{fontSize:11,color:"var(--muted)",marginTop:4,paddingLeft:2}}>Contact your administrator to change your email.</p>
        </div>
        <button
          style={{width:"100%",padding:"clamp(13px,3.8vw,15px)",background:"linear-gradient(135deg,var(--teal),var(--teal3))",border:"none",borderRadius:99,fontFamily:"var(--nunito)",fontSize:"clamp(14px,4vw,15px)",fontWeight:700,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 6px 20px rgba(0,180,160,0.35)"}}
          onClick={handleSave} disabled={busy}>
          {busy ? <><span className="spin" style={{width:16,height:16,borderWidth:2}}/>Saving…</> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Privacy & Security Sheet
function PrivacySecuritySheet({ user, onClose, showToast }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showC, setShowC]         = useState(false);
  const [showN, setShowN]         = useState(false);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");
  const [success, setSuccess]     = useState("");
  const pwStr = passwordStrength(newPw);

  const handleChange = async () => {
    setErr(""); setSuccess("");
    if (!currentPw) { setErr("Enter your current password."); return; }
    if (!newPw) { setErr("Enter a new password."); return; }
    if (newPw.length < 6) { setErr("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      // Re-authenticate first
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
      if (reAuthErr) throw new Error("Current password is incorrect.");
      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setSuccess("✅ Password changed successfully!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      showToast("✅ Password updated!");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">Privacy & Security</p>
        {err     && <div className="admin-err">{err}</div>}
        {success && <div className="admin-success">{success}</div>}
        <p style={{fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,color:"var(--text)",marginBottom:12}}>Change Password</p>
        <div className="form-field">
          <label>Current Password</label>
          <div className="form-input-wrap">
            <input className="form-input teal-focus" type={showC?"text":"password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Your current password"/>
            <svg className="form-eye" viewBox="0 0 24 24" onClick={() => setShowC(v => !v)}>
              {showC ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
            </svg>
          </div>
        </div>
        <div className="form-field">
          <label>New Password</label>
          <div className="form-input-wrap">
            <input className="form-input teal-focus" type={showN?"text":"password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters"/>
            <svg className="form-eye" viewBox="0 0 24 24" onClick={() => setShowN(v => !v)}>
              {showN ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
            </svg>
          </div>
          {newPw && (
            <div className="pw-strength">
              {[1,2,3,4].map(i => (
                <div key={i} className="pw-bar" style={{background: i <= Math.ceil(pwStr.score * 4/5)
                  ? pwStr.score >= 5 ? "#059669" : pwStr.score >= 3 ? "#34d399" : pwStr.score >= 2 ? "#fb923c" : "#f87171"
                  : "#e5e7eb"}}/>
              ))}
              <span className="pw-label">{pwStr.label}</span>
            </div>
          )}
        </div>
        <div className="form-field">
          <label>Confirm New Password</label>
          <input className="form-input teal-focus" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"/>
        </div>
        <button
          style={{width:"100%",padding:"clamp(13px,3.8vw,15px)",background:"linear-gradient(135deg,var(--teal),var(--teal3))",border:"none",borderRadius:99,fontFamily:"var(--nunito)",fontSize:"clamp(14px,4vw,15px)",fontWeight:700,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 6px 20px rgba(0,180,160,0.35)"}}
          onClick={handleChange} disabled={busy}>
          {busy ? <><span className="spin" style={{width:16,height:16,borderWidth:2}}/>Updating…</> : "Update Password"}
        </button>
      </div>
    </div>
  );
}

// Help & Support Sheet
function HelpSupportSheet({ onClose }) {
  const faqs = [
    { q:"How do I upload files?", a:"Tap the + button at the bottom center, or use the Upload quick action on the home screen. You can select multiple files at once." },
    { q:"What file types are supported?", a:"ZharmVault supports all file types: images (JPG, PNG, GIF, WebP), videos (MP4, MOV, AVI), and documents (PDF, DOC, DOCX, XLSX, PPTX, ZIP, TXT)." },
    { q:"How do I share a file?", a:"Open a file, tap the ··· menu, then tap 'Share Link'. The signed URL will be copied to your clipboard — it's valid for 1 hour." },
    { q:"Can I change my password?", a:"Yes! Go to Profile → Privacy & Security → Change Password." },
    { q:"Who can access my files?", a:"Only you can access your files. Admins can view and manage all files in the system." },
    { q:"How do I contact the admin?", a:"Reach out to your system administrator directly. They manage your account, storage limits, and access." },
  ];
  const [open, setOpen] = useState(null);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">Help & Support</p>
        <div className="info-box" style={{marginBottom:16}}>
          <strong>Need help?</strong> Browse the FAQs below or contact your administrator for account-related issues.
        </div>
        {faqs.map((f, i) => (
          <div key={i} style={{borderBottom:"1px solid #f3f4f6",paddingBottom:12,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:12}} onClick={() => setOpen(open===i?null:i)}>
              <p style={{fontSize:"clamp(12px,3.4vw,14px)",fontWeight:600,color:"var(--text)",flex:1}}>{f.q}</p>
              <span style={{color:"var(--muted)",fontSize:18,flexShrink:0,transform:open===i?"rotate(180deg)":"none",transition:"transform 0.2s"}}>⌄</span>
            </div>
            {open===i && <p style={{fontSize:"clamp(11px,3vw,13px)",color:"var(--muted)",marginTop:8,lineHeight:1.6}}>{f.a}</p>}
          </div>
        ))}
        <div style={{background:"#f9fafb",borderRadius:14,padding:"14px 16px",marginTop:4}}>
          <p style={{fontSize:"clamp(11px,3vw,13px)",fontWeight:600,color:"var(--text)",marginBottom:4}}>Still need help?</p>
          <p style={{fontSize:"clamp(10px,2.8vw,12px)",color:"var(--muted)",lineHeight:1.5}}>Contact your system administrator for account issues, storage upgrades, or technical problems.</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   ADMIN — CREATE / EDIT USER
════════════════════════════════ */
function EditUserSheet({ profile, onClose, onSaved, showToast }) {
  const isNew = !profile;
  const [name,    setName]    = useState(profile?.full_name || "");
  const [email,   setEmail]   = useState(profile?.email || "");
  const [pass,    setPass]    = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [limit,   setLimit]   = useState(profile?.storage_limit ? (profile.storage_limit / 1024 ** 3).toFixed(0) : "5");
  const [isAdmin, setIsAdmin] = useState(profile?.is_admin || false);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [success, setSuccess] = useState("");
  const pwStr = passwordStrength(pass);

  const handleSave = async () => {
    setErr(""); setSuccess("");
    if (!name.trim()) { setErr("Full name is required."); return; }
    if (isNew) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address."); return; }
      if (!pass || pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    }
    const limitBytes = parseFloat(limit) * 1024 ** 3;
    if (isNaN(limitBytes) || limitBytes <= 0) { setErr("Storage limit must be a positive number (GB)."); return; }
    setBusy(true);
    try {
      if (isNew) {
        await adminCreateUser({ full_name: name.trim(), email: email.trim(), password: pass, storage_limit: limitBytes, is_admin: isAdmin });
        setSuccess("✅ User created successfully!");
        showToast("✅ User created");
        onSaved();
        setTimeout(() => onClose(), 1800);
      } else {
        await adminUpdateProfile(profile.id, { full_name: name.trim(), storage_limit: limitBytes, is_admin: isAdmin });
        showToast("✅ Profile updated");
        onSaved(); onClose();
      }
    } catch (e) { setErr(e.message || "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">{isNew ? "Create New User" : "Edit User"}</p>
        {isNew && (
          <div className="info-box info-box-warn" style={{marginBottom:14}}>
            <strong>Note:</strong> Make sure <em>"Disable email confirmations"</em> is turned ON in your Supabase Auth settings, otherwise the new user must verify their email before logging in.
          </div>
        )}
        {err     && <div className="admin-err">{err}</div>}
        {success && <div className="admin-success">{success}</div>}
        <div className="form-field">
          <label>Full Name <span style={{color:"#e11d48"}}>*</span></label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Dela Cruz"/>
        </div>
        <div className="form-field">
          <label>Email Address {isNew && <span style={{color:"#e11d48"}}>*</span>}</label>
          {isNew ? (
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" autoComplete="off"/>
          ) : (
            <div className="form-id-box" style={{borderStyle:"solid",background:"#f3f4f6"}}>
              <span style={{fontSize:"clamp(12px,3vw,13px)",fontFamily:"var(--dm)",color:"var(--text)"}}>{profile?.email || "—"}</span>
              <span style={{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap"}}>Read-only</span>
            </div>
          )}
        </div>
        {isNew && (
          <div className="form-field">
            <label>Password <span style={{color:"#e11d48"}}>*</span></label>
            <div className="form-input-wrap">
              <input className="form-input" type={showPw?"text":"password"} value={pass} onChange={e => setPass(e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password"/>
              <svg className="form-eye" viewBox="0 0 24 24" onClick={() => setShowPw(v => !v)}>
                {showPw ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
              </svg>
            </div>
            {pass && (
              <div className="pw-strength">
                {[1,2,3,4].map(i => (
                  <div key={i} className="pw-bar" style={{background: i <= Math.ceil(pwStr.score * 4/5)
                    ? pwStr.score >= 5 ? "#059669" : pwStr.score >= 3 ? "#34d399" : pwStr.score >= 2 ? "#fb923c" : "#f87171"
                    : "#e5e7eb"}}/>
                ))}
                <span className="pw-label">{pwStr.label}</span>
              </div>
            )}
          </div>
        )}
        <div className="form-field">
          <label>Storage Limit (GB) <span style={{color:"#e11d48"}}>*</span></label>
          <input className="form-input" type="number" min="1" max="1000" value={limit} onChange={e => setLimit(e.target.value)} placeholder="5"/>
        </div>
        <div className="form-field">
          <label>Admin Privileges</label>
          <div className="form-toggle" onClick={() => setIsAdmin(v => !v)}>
            <span className="form-toggle-label">{isAdmin ? "✓ Admin account" : "Regular user"}</span>
            <div className={`toggle-switch ${isAdmin?"on":""}`}><div className="toggle-knob"/></div>
          </div>
        </div>
        <button className="admin-btn" onClick={handleSave} disabled={busy}>
          {busy ? <><span className="spin" style={{width:16,height:16,borderWidth:2}}/>{isNew?"Creating…":"Saving…"}</> : isNew ? "Create Account" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   ADMIN USERS TAB
════════════════════════════════ */
function AdminUsersTab({ showToast, currentUserId }) {
  const [profiles, setProfiles]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [query,    setQuery]      = useState("");
  const [editTarget, setEditTarget] = useState(undefined);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProfiles(await adminFetchAllProfiles()); }
    catch (e) { showToast("❌ " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = profiles.filter(p =>
    (p.full_name||"").toLowerCase().includes(query.toLowerCase()) ||
    (p.email||"").toLowerCase().includes(query.toLowerCase())
  );

  const handleToggleDisable = async (p) => {
    try {
      await adminUpdateProfile(p.id, { is_disabled: !p.is_disabled });
      showToast(p.is_disabled ? "✅ User enabled" : "⛔ User disabled");
      load();
    } catch (e) { showToast("❌ " + e.message); }
  };

  const handleDelete = async (p) => {
    try {
      await adminDeleteProfile(p.id);
      showToast("🗑️ User deleted");
      setDeleteTarget(null);
      load();
    } catch (e) { showToast("❌ " + e.message); }
  };

  const initials = (name) => (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <>
      <div style={{display:"flex",gap:10,marginBottom:"clamp(14px,4vw,20px)"}}>
        <div className="search-bar" style={{flex:1}}>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search users…" value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        <button
          style={{flexShrink:0,padding:"0 14px",height:"44px",background:"linear-gradient(135deg,var(--admin),var(--admin2))",border:"none",borderRadius:12,color:"#fff",fontFamily:"var(--nunito)",fontSize:"clamp(12px,3.2vw,13px)",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}
          onClick={() => setEditTarget(null)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New User
        </button>
      </div>

      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:"32px 0"}}><div className="spin spin-admin" style={{width:32,height:32}}/></div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          <h3>No users found</h3><p>{query ? "Try a different search" : "No profiles in the database"}</p>
        </div>
      ) : visible.map(p => {
        const usedPct = p.storage_limit ? Math.min((p.storage_used||0)/p.storage_limit*100,100) : 0;
        const isSelf  = p.id === currentUserId;
        return (
          <div className={`user-card ${p.is_disabled?"disabled-user":""}`} key={p.id}>
            <div className="user-card-top">
              <div className="user-avatar">{initials(p.full_name)}</div>
              <div className="user-info">
                <p className="user-name">{p.full_name||"Unnamed"} {isSelf && <span style={{fontSize:10,color:"var(--teal2)",fontWeight:700}}>(you)</span>}</p>
                <p className="user-email">{p.email||p.id}</p>
                <div className="user-badges">
                  {p.is_admin    && <span className="badge badge-admin">Admin</span>}
                  {p.is_disabled ? <span className="badge badge-disabled">Disabled</span> : <span className="badge badge-active">Active</span>}
                </div>
              </div>
            </div>
            <div className="user-card-meta">
              <span className="user-meta-item"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>{formatSize(p.storage_used||0)} used</span>
              <span className="user-meta-item"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{timeAgo(p.created_at)}</span>
              <span className="user-meta-item"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>{formatGB(p.storage_limit||0)} limit</span>
            </div>
            <div className="user-stor-bar"><div className="user-stor-fill" style={{width:`${usedPct}%`}}/></div>
            <div className="user-actions">
              <button className="ua-btn edit" onClick={() => setEditTarget(p)}>
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
              </button>
              {!isSelf && (
                <button className={`ua-btn ${p.is_disabled?"enable":"disable"}`} onClick={() => handleToggleDisable(p)}>
                  {p.is_disabled
                    ? <><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Enable</>
                    : <><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Disable</>}
                </button>
              )}
              {!isSelf && (
                <button className="ua-btn del" onClick={() => setDeleteTarget(p)}>
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      {editTarget !== undefined && (
        <EditUserSheet profile={editTarget} onClose={() => setEditTarget(undefined)} onSaved={load} showToast={showToast}/>
      )}
      {deleteTarget && (
        <DeleteConfirmSheet
          title="Delete user?"
          sub={`Permanently delete ${deleteTarget.full_name||"this user"} and all their files. This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </>
  );
}

/* ════════════════════════════════
   ADMIN FILES TAB
════════════════════════════════ */
function AdminFilesTab({ showToast }) {
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewer,  setViewer]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFiles(await adminFetchAllFiles()); }
    catch (e) { showToast("❌ " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = files.filter(f => (f.original_name||"").toLowerCase().includes(query.toLowerCase()));

  const handleDelete = async (record) => {
    try {
      await deleteFile(record);
      showToast("🗑️ File deleted");
      setDeleteTarget(null);
      load();
    } catch (e) { showToast("❌ " + e.message); }
  };

  return (
    <>
      <div className="search-bar" style={{marginBottom:16}}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Search files…" value={query} onChange={e => setQuery(e.target.value)}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:"clamp(11px,3vw,13px)",color:"var(--muted)",fontWeight:600}}>{visible.length} files across all users</span>
      </div>
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:"32px 0"}}><div className="spin spin-admin" style={{width:32,height:32}}/></div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
          <h3>No files found</h3><p>{query ? "Try a different search" : "No files uploaded yet"}</p>
        </div>
      ) : (
        <div className="file-list" style={{marginBottom:0}}>
          {visible.map(f => (
            <div className="admin-file-row" key={f.id}>
              <div className={`file-thumb ft-${getFileType(f.category)}`} style={{cursor:"pointer"}} onClick={() => setViewer(f)}>
                <FileThumb type={getFileType(f.category)}/>
              </div>
              <div className="file-info" style={{cursor:"pointer"}} onClick={() => setViewer(f)}>
                <p className="file-name">{f.original_name}</p>
                <p className="admin-file-owner">uid: {f.user_id?.slice(0,8)}…</p>
                <p className="file-meta">{formatSize(f.size)} · {timeAgo(f.created_at)}</p>
              </div>
              <button className="admin-del-btn" onClick={() => setDeleteTarget(f)}>
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {viewer && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
      {deleteTarget && (
        <DeleteConfirmSheet
          title="Delete file?"
          sub={`Permanently delete "${deleteTarget.original_name}". This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </>
  );
}

/* ════════════════════════════════
   ADMIN PAGE
════════════════════════════════ */
function AdminPage({ user, userId, onLogout, showToast, refreshKey }) {
  const [tab, setTab] = useState("users");
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ users:0, files:0, storage:0 });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    fetchProfile(userId).then(p => setProfile(p));
    Promise.all([adminFetchAllProfiles(), adminFetchAllFiles()]).then(([profiles, files]) => {
      setStats({ users: profiles.length, files: files.length, storage: files.reduce((s,f) => s+(f.size||0), 0) });
    }).catch(() => {});
  }, [userId, refreshKey]);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Admin";

  return (
    <div className="admin-page">
      <div className="admin-hdr">
        <div className="admin-hdr-row">
          <div className="admin-badge">
            <div className="admin-badge-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
            <div>
              <p className="admin-badge-label">Admin Panel</p>
              <p className="admin-badge-sub">{displayName}</p>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Log out">
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
        <div className="admin-stats">
          <div className="admin-stat"><p className="astat-val">{stats.users}</p><p className="astat-lbl">Users</p></div>
          <div className="admin-stat"><p className="astat-val">{stats.files}</p><p className="astat-lbl">Files</p></div>
          <div className="admin-stat"><p className="astat-val">{formatGB(stats.storage)}</p><p className="astat-lbl">Used</p></div>
        </div>
      </div>
      <div className="admin-body">
        <div className="sheet-pill"/>
        <div className="admin-tabs">
          <button className={`admin-tab ${tab==="users"?"active":""}`} onClick={() => setTab("users")}>
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Users
          </button>
          <button className={`admin-tab ${tab==="files"?"active":""}`} onClick={() => setTab("files")}>
            <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>All Files
          </button>
        </div>
        {tab==="users" && <AdminUsersTab showToast={showToast} currentUserId={userId}/>}
        {tab==="files" && <AdminFilesTab showToast={showToast}/>}
      </div>
      {showLogoutConfirm && <LogoutConfirm onCancel={() => setShowLogoutConfirm(false)} onConfirm={onLogout}/>}
    </div>
  );
}

/* ════════════════════════════════
   HOME BODY
════════════════════════════════ */
function HomeBody({ userId, showToast, onUploadDone, refreshKey, onNavigate }) {
  const [files, setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUp, setShowUp] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [opts,   setOpts]   = useState(null);
  const mcColors = ["mc1","mc2","mc3","mc4","mc5","mc6"];

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchFiles(userId);
    setFiles(data); setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (record) => {
    setOpts(null);
    try { await deleteFile(record); showToast("🗑️ File deleted"); load(); onUploadDone(); }
    catch (e) { showToast("❌ " + e.message); }
  };

  const imageFiles = files.filter(f => f.category==="images").slice(0,6);

  return (
    <>
      <div className="home-body">
        <div className="sheet-pill"/>
        <div className="sec-hdr"><span className="sec-title">Quick Actions</span></div>
        <div className="qa-grid">
          {[
            { c:"teal",   l:"Upload", fn:() => setShowUp(true), icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> },
            { c:"blue",   l:"Photos", fn:() => onNavigate("files"), icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
            { c:"violet", l:"Videos", fn:() => onNavigate("files"), icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
            { c:"rose",   l:"Gallery",fn:() => onNavigate("gallery"), icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> },
          ].map((a,i) => (
            <div className="qa-btn" key={i} onClick={a.fn}>
              <div className={`qa-icon ${a.c}`}><svg viewBox="0 0 24 24">{a.icon}</svg></div>
              <span className="qa-label">{a.l}</span>
            </div>
          ))}
        </div>

        <div className="sec-hdr" style={{marginTop:4}}>
          <span className="sec-title">Recent Files</span>
          <span className="sec-link" onClick={() => onNavigate("files")}>See All</span>
        </div>
        {loading ? (
          <div style={{display:"flex",justifyContent:"center",padding:"24px 0"}}><div className="spin spin-teal" style={{width:28,height:28}}/></div>
        ) : files.length === 0 ? (
          <div className="empty" style={{padding:"20px 0"}}>
            <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
            <h3>No files yet</h3><p>Tap Upload to add your first file</p>
          </div>
        ) : (
          <div className="file-list">
            {files.slice(0,4).map(f => (
              <div className="file-row" key={f.id} onClick={() => setViewer(f)}>
                <div className={`file-thumb ft-${getFileType(f.category)}`}><FileThumb type={getFileType(f.category)}/></div>
                <div className="file-info"><p className="file-name">{f.original_name}</p><p className="file-meta">{timeAgo(f.created_at)}</p></div>
                <span className="file-size">{formatSize(f.size)}</span>
                <span className="file-dots" onClick={e => { e.stopPropagation(); setOpts(f); }}>···</span>
              </div>
            ))}
          </div>
        )}

        <div className="sec-hdr">
          <span className="sec-title">Media Gallery</span>
          <span className="sec-link" onClick={() => onNavigate("gallery")}>See All</span>
        </div>
        {imageFiles.length === 0 ? (
          <div className="empty" style={{padding:"16px 0"}}>
            <div className="empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
            <p>Upload images to see them here</p>
          </div>
        ) : (
          <div className="media-grid">
            {imageFiles.map((f,i) => (
              <div className={`media-cell ${mcColors[i%6]}`} key={f.id} onClick={() => setViewer(f)}><ImageThumb record={f}/></div>
            ))}
          </div>
        )}
      </div>

      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={() => { load(); onUploadDone(); }} showToast={showToast}/>}
      {viewer  && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
      {opts    && <FileOptions record={opts} onClose={() => setOpts(null)} onView={() => { setViewer(opts); setOpts(null); }} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); setOpts(null); }} onDelete={() => handleDelete(opts)}/>}
    </>
  );
}

/* ════════════════════════════════
   FILES BODY
════════════════════════════════ */
function FilesBody({ userId, showToast, refreshKey, onUploadDone }) {
  const [files,   setFiles]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter] = useState("all");
  const [query,   setQuery]  = useState("");
  const [viewer,  setViewer] = useState(null);
  const [opts,    setOpts]   = useState(null);
  const [showUp,  setShowUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchFiles(userId, filter==="all" ? null : filter);
    setFiles(data); setLoading(false);
  }, [userId, filter]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const visible = files.filter(f => f.original_name.toLowerCase().includes(query.toLowerCase()));

  const handleDelete = async (record) => {
    setOpts(null);
    try { await deleteFile(record); showToast("🗑️ File deleted"); load(); onUploadDone(); }
    catch (e) { showToast("❌ " + e.message); }
  };

  return (
    <>
      <div className="home-body">
        <div className="sheet-pill"/>
        <div className="sec-hdr"><span className="sec-title">All Files</span><span className="sec-link">{visible.length} items</span></div>
        <div className="search-wrap">
          <div className="search-bar">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search files…" value={query} onChange={e => setQuery(e.target.value)}/>
          </div>
          <div className="sort-btn" onClick={() => setShowUp(true)}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
        </div>
        <div className="filter-row">
          {["all","images","videos","docs"].map(f => (
            <span key={f} className={`filter-chip ${filter===f?"active":""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </span>
          ))}
        </div>
        {loading ? (
          <div style={{display:"flex",justifyContent:"center",padding:"32px 0"}}><div className="spin spin-teal" style={{width:32,height:32}}/></div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
            <h3>No files found</h3><p>{query ? "Try a different search term" : "Upload your first file using the button above"}</p>
          </div>
        ) : (
          <div className="file-list">
            {visible.map(f => (
              <div className="file-row" key={f.id} onClick={() => setViewer(f)}>
                <div className={`file-thumb ft-${getFileType(f.category)}`}><FileThumb type={getFileType(f.category)}/></div>
                <div className="file-info"><p className="file-name">{f.original_name}</p><p className="file-meta">{timeAgo(f.created_at)} · {formatSize(f.size)}</p></div>
                <span className="file-dots" onClick={e => { e.stopPropagation(); setOpts(f); }}>···</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={() => { load(); onUploadDone(); }} showToast={showToast}/>}
      {viewer  && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
      {opts    && <FileOptions record={opts} onClose={() => setOpts(null)} onView={() => { setViewer(opts); setOpts(null); }} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); setOpts(null); }} onDelete={() => handleDelete(opts)}/>}
    </>
  );
}

/* ════════════════════════════════
   GALLERY BODY
════════════════════════════════ */
function GalleryBody({ userId, showToast, refreshKey }) {
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer,  setViewer]  = useState(null);
  const mcColors = ["mc1","mc2","mc3","mc4","mc5","mc6"];
  useEffect(() => {
    setLoading(true);
    fetchFiles(userId, "images").then(d => setFiles(d)).finally(() => setLoading(false));
  }, [userId, refreshKey]);
  return (
    <>
      <div className="home-body">
        <div className="sheet-pill"/>
        <div className="sec-hdr"><span className="sec-title">Media Gallery</span><span className="sec-link">{files.length} images</span></div>
        {loading ? (
          <div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}><div className="spin spin-teal" style={{width:32,height:32}}/></div>
        ) : files.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
            <h3>No images yet</h3><p>Upload image files to see them here</p>
          </div>
        ) : (
          <div className="media-grid">
            {files.map((f,i) => (
              <div className={`media-cell ${mcColors[i%6]}`} key={f.id} onClick={() => setViewer(f)}><ImageThumb record={f}/></div>
            ))}
          </div>
        )}
      </div>
      {viewer && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
    </>
  );
}

/* ════════════════════════════════
   PROFILE BODY
════════════════════════════════ */
function ProfileBody({ user, userId, onLogout, showToast, refreshKey }) {
  const [profile, setProfile]       = useState(null);
  const [fileCount, setFileCount]   = useState(0);
  const [showLogout, setShowLogout] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showHelp, setShowHelp]     = useState(false);

  const loadProfile = useCallback(async () => {
    const p = await fetchProfile(userId);
    setProfile(p);
  }, [userId]);

  useEffect(() => {
    loadProfile();
    fetchFiles(userId).then(f => setFileCount(f.length));
  }, [userId, refreshKey]);

  const usedPct = profile ? Math.min((profile.storage_used / profile.storage_limit) * 100, 100).toFixed(1) : 0;
  const displayName = (profile?.full_name || user?.email?.split("@")[0] || "User").trim();
  const nameParts = displayName.split(" ");
  const initials = nameParts.map(w => w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div className="home-page prof-page">
      <div className="prof-hdr">
        <div className="prof-avatar">
          <span className="prof-avatar-initials">{initials}</span>
        </div>
        <p className="prof-name">
          {nameParts[0]} {nameParts.length > 1 && <span style={{color:"var(--tl)"}}>{nameParts.slice(1).join(" ")}</span>}
        </p>
        <p className="prof-email">{user?.email}</p>
      </div>
      <div className="prof-body">
        <div className="sheet-pill"/>
        <div className="prof-stats">
          {[
            [fileCount.toString(), "Files"],
            [profile ? formatGB(profile.storage_used) : "—", "Used"],
            [profile ? `${usedPct}%` : "—", "Full"],
          ].map(([v,l]) => (
            <div className="prof-stat" key={l}><p className="pstat-val">{v}</p><p className="pstat-lbl">{l}</p></div>
          ))}
        </div>
        {profile && (
          <div style={{marginBottom:"clamp(22px,6vw,30px)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:"clamp(11px,3vw,13px)",fontWeight:600,color:"var(--text)"}}>Storage</span>
              <span style={{fontSize:"clamp(10px,2.8vw,12px)",color:"var(--muted)"}}>{formatGB(profile.storage_used)} / {formatGB(profile.storage_limit)}</span>
            </div>
            <div style={{height:8,background:"#f3f4f6",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${usedPct}%`,background:"linear-gradient(90deg,var(--teal),var(--teal3))",borderRadius:99,transition:"width 0.6s"}}/>
            </div>
          </div>
        )}
        <div className="menu-list">
          {[
            { icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>, label:"Edit Profile",       sub:"Update your name",          color:"teal",   fn:() => setShowEdit(true) },
            { icon:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,                           label:"Privacy & Security",     sub:"Change password",           color:"blue",   fn:() => setShowPrivacy(true) },
            { icon:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,                  label:"Notifications",          sub:"Manage alerts",             color:"violet", fn:() => showToast("🔔 No new notifications") },
            { icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, label:"Storage Plan", sub:`${formatGB(profile?.storage_limit||0)} allocated`, color:"rose", fn:() => showToast("💾 Contact admin to upgrade storage") },
            { icon:<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></>,        label:"Help & Support",         sub:"FAQs & contact",            color:"amber",  fn:() => setShowHelp(true) },
          ].map((m,i) => (
            <div className="menu-row" key={i} onClick={m.fn}>
              <div className={`menu-row-icon qa-icon ${m.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{m.icon}</svg></div>
              <div className="menu-row-info"><p className="menu-row-title">{m.label}</p><p className="menu-row-sub">{m.sub}</p></div>
              <span className="menu-row-arrow">›</span>
            </div>
          ))}
        </div>
        <div className="logout-row">
          <button className="logout-btn" onClick={() => setShowLogout(true)}>Log Out</button>
        </div>
      </div>

      {showLogout  && <LogoutConfirm onCancel={() => setShowLogout(false)} onConfirm={onLogout}/>}
      {showEdit    && <EditProfileSheet profile={profile} user={user} onClose={() => setShowEdit(false)} onSaved={loadProfile} showToast={showToast}/>}
      {showPrivacy && <PrivacySecuritySheet user={user} onClose={() => setShowPrivacy(false)} showToast={showToast}/>}
      {showHelp    && <HelpSupportSheet onClose={() => setShowHelp(false)}/>}
    </div>
  );
}

/* ════════════════════════════════
   HOME PAGE (shell + nav)
════════════════════════════════ */
function HomePage({ user, onLogout, isAdmin }) {
  const [nav,     setNav]    = useState("home");
  const [toast,   setToast]  = useState("");
  const [profile, setProfile] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [showUp,  setShowUp] = useState(false);
  const userId = user.id;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };
  const onUploadDone = () => setRefresh(r => r + 1);

  useEffect(() => { fetchProfile(userId).then(p => setProfile(p)); }, [userId, refresh]);

  const usedPct = profile ? Math.min((profile.storage_used / profile.storage_limit) * 100, 100) : 0;
  const displayName = (profile?.full_name || user?.email?.split("@")[0] || "User").trim().split(" ");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const navL = [
    { id:"home",  label:"Home",  icon:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { id:"files", label:"Files", icon:<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></> },
  ];
  const navR = [
    { id:"gallery", label:"Gallery", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
    isAdmin
      ? { id:"admin",   label:"Admin",   icon:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, admin: true }
      : { id:"profile", label:"Profile", icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  ];

  const showHeader = nav !== "profile" && nav !== "admin";

  // Expose navigate to children via callback
  const handleNavigate = (page) => setNav(page);

  return (
    <div className="home-page">
      {showHeader && (
        <div className="home-header">
          <div className="hdr-row">
            <div className="hdr-brand">
              <div className="hdr-brand-icon"><CloudIcon/></div>
              <span className="hdr-brand-name">Zharm<span>Vault</span></span>
            </div>
            <div className="hdr-notif" onClick={() => showToast("🔔 No new notifications")}>
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              <div className="notif-dot"/>
            </div>
          </div>
          <div className="hdr-greet">
            <p className="hdr-greet-sub">{greeting} 👋</p>
            <h2 className="hdr-greet-name">{displayName[0]} <span>{displayName.slice(1).join(" ")}</span></h2>
            <p className="hdr-greet-desc">Your files are safe & organized</p>
          </div>
          <div className="stor-card">
            <div className="stor-top">
              <span className="stor-lbl">Storage Used</span>
              <span className="stor-amt">{profile ? `${formatGB(profile.storage_used)} / ${formatGB(profile.storage_limit)}` : "Loading…"}</span>
            </div>
            <div className="stor-track"><div className="stor-fill" style={{width:`${usedPct}%`}}/></div>
            <div className="stor-types">
              {[["#7FFFD4","Images"],["#C4B5FD","Videos"],["#FDE68A","Docs"]].map(([c,l]) => (
                <div className="stor-type" key={l}><div className="s-dot" style={{background:c}}/><span>{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {nav==="home"    && <HomeBody    userId={userId} showToast={showToast} onUploadDone={onUploadDone} refreshKey={refresh} onNavigate={handleNavigate}/>}
      {nav==="files"   && <FilesBody   userId={userId} showToast={showToast} onUploadDone={onUploadDone} refreshKey={refresh}/>}
      {nav==="gallery" && <GalleryBody userId={userId} showToast={showToast} refreshKey={refresh}/>}
      {nav==="profile" && <ProfileBody user={user} userId={userId} onLogout={onLogout} showToast={showToast} refreshKey={refresh}/>}
      {nav==="admin"   && <AdminPage   user={user} userId={userId} onLogout={onLogout} showToast={showToast} refreshKey={refresh}/>}

      {toast && <div className="toast">{toast}</div>}

      <div className="bottom-nav">
        {navL.map(n => (
          <div className="nav-item" key={n.id} onClick={() => setNav(n.id)}>
            <div className={`nav-icon-wrap ${nav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${nav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}
        <div className="nav-fab" onClick={() => setShowUp(true)}>
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        {navR.map(n => (
          <div className="nav-item" key={n.id} onClick={() => setNav(n.id)}>
            <div className={`nav-icon-wrap ${nav===n.id ? (n.admin?"active-admin":"active") : ""}`}>
              <svg viewBox="0 0 24 24">{n.icon}</svg>
            </div>
            <span className={`nav-lbl ${nav===n.id ? (n.admin?"active-admin":"active") : ""}`}>{n.label}</span>
          </div>
        ))}
      </div>

      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={onUploadDone} showToast={showToast}/>}
    </div>
  );
}

/* ════════════════════════════════
   ROOT
════════════════════════════════ */
export default function App() {
  const [user,    setUser]    = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (u) {
        const p = await fetchProfile(u.id);
        // Block disabled or deleted users immediately
        if (!p || p.is_disabled) {
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
        setIsAdmin(!!p?.is_admin);
      }
      setUser(u);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      if (u) {
        const p = await fetchProfile(u.id);
        if (!p || p.is_disabled) {
          await supabase.auth.signOut();
          setUser(null);
          setIsAdmin(false);
          return;
        }
        setIsAdmin(!!p?.is_admin);
        setUser(u);
      } else {
        setIsAdmin(false);
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  if (user === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div className="cv-app">
          <div className="page-loader">
            <div className="page-loader-inner">
              <div className="spin" style={{width:36,height:36,borderWidth:3,borderColor:"rgba(0,201,167,0.2)",borderTopColor:"var(--teal)"}}/>
              <span>ZharmVault</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cv-app">
        {!user
          ? <AuthPage onAuth={async (u) => { const p = await fetchProfile(u.id); setIsAdmin(!!p?.is_admin); setUser(u); }}/>
          : <HomePage user={user} onLogout={handleLogout} isAdmin={isAdmin}/>
        }
      </div>
    </>
  );
}
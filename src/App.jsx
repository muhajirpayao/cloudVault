import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://oynuqcbqcxfoalmlxiwx.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bnVxY2JxY3hmb2FsbWx4aXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzE0ODgsImV4cCI6MjA5NTkwNzQ4OH0.04xWAzu6W_5inGAppDvRlDqrPoOOqbfSsAOdHyuAUEc";
const supabase      = createClient(SUPABASE_URL, SUPABASE_ANON);

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

/* ── STORAGE ── */
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

/* ── STYLES ── */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow-x:hidden}
:root{
  --teal:#00C9A7;--teal2:#00A888;--teal3:#0097B2;--tl:#7FFFD4;
  --bg:#f5f7fa;--white:#fff;--text:#111827;--muted:#6b7280;
  --border:#e5e7eb;--red:#FF6B6B;
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
.nav-icon-wrap svg{width:clamp(16px,4.5vw,20px);height:clamp(16px,4.5vw,20px);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke:#9ca3af}
.nav-icon-wrap.active svg{stroke:#059669}
.nav-lbl{font-size:clamp(9px,2.4vw,11px);font-weight:600;color:#9ca3af}
.nav-lbl.active{color:#059669}
.nav-fab{width:clamp(46px,13vw,56px);height:clamp(46px,13vw,56px);background:linear-gradient(135deg,var(--teal),var(--teal3));border-radius:clamp(13px,4vw,18px);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,180,160,0.4);margin-top:-8px;cursor:pointer;transition:transform 0.15s}
.nav-fab:active{transform:scale(0.94)}
.nav-fab svg{width:clamp(20px,5.5vw,24px);height:clamp(20px,5.5vw,24px);stroke:#fff;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}

/* MODALS */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:flex-end;backdrop-filter:blur(3px);animation:fadeIn 0.2s ease}
.sheet{background:var(--white);border-radius:clamp(20px,6vw,28px) clamp(20px,6vw,28px) 0 0;padding:clamp(20px,6vw,28px) clamp(18px,5vw,26px) clamp(28px,8vw,40px);width:100%;animation:slideUp 0.25s ease;max-height:90svh;overflow-y:auto}
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
@keyframes spin{to{transform:rotate(360deg)}}
.page-loader{display:flex;align-items:center;justify-content:center;min-height:100svh;background:var(--white)}
.page-loader-inner{display:flex;flex-direction:column;align-items:center;gap:16px}
.page-loader-inner span{font-family:var(--nunito);font-size:15px;font-weight:700;color:var(--teal2)}
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

/* ── LOGOUT CONFIRM SHEET ── */
function LogoutConfirm({ onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="logout-confirm-icon">
          <svg viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <p className="logout-confirm-title">Log out?</p>
        <p className="logout-confirm-sub">You'll need to sign in again to access your files and storage.</p>
        <div className="logout-confirm-btns">
          <button className="logout-cancel-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="logout-confirm-btn" onClick={handleConfirm} disabled={busy}>
            {busy ? <><span className="spin" style={{width:16,height:16,borderWidth:2}}/></> : "Yes, log out"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AUTH ── */
// CHANGED: login-only, no signup tab, no sign-up form
function AuthPage({ onAuth }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [show, setShow]   = useState(false);
  const [rem, setRem]     = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const handle = async () => {
    setErr("");
    if (!email || !pass) { setErr("Please enter your email and password."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      onAuth(data.user);
    } catch (e) {
      setErr(e.message || "Invalid email or password.");
    } finally {
      setBusy(false);
    }
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
          <span className="auth-brand-name">Cloud<span>Vault</span></span>
        </div>
        <h2 className="auth-headline">Welcome Back 👋</h2>
        <p className="auth-sub">Sign in with your credentials to access your files and storage.</p>

        {err && <div className="auth-err">{err}</div>}

        <div className="cv-field">
          <label>Email Address</label>
          <div className="cv-input-wrap">
            <svg className="fi" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <input className="cv-input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()}/>
          </div>
        </div>

        <div className="cv-field">
          <label>Password</label>
          <div className="cv-input-wrap">
            <svg className="fi" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input className="cv-input" type={show?"text":"password"} placeholder="Enter your password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()}/>
            <svg className="cv-eye" viewBox="0 0 24 24" onClick={() => setShow(!show)} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8">
              {show ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
            </svg>
          </div>
        </div>

        <div className="cv-row">
          <label className="cv-remember"><input type="checkbox" checked={rem} onChange={e => setRem(e.target.checked)}/><span>Remember Me</span></label>
          <span className="cv-forgot">Forgot Password?</span>
        </div>

        <button className="cv-btn" onClick={handle} disabled={busy}>
          {busy ? <><span className="spin"/>Signing in…</> : "Sign In →"}
        </button>
      </div>
    </div>
  );
}

/* ── FILE VIEWER ── */
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

/* ── FILE OPTIONS ── */
function FileOptions({ record, onClose, onView, onDownload, onDelete }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title" style={{fontSize:"clamp(13px,3.6vw,15px)",marginBottom:6,fontWeight:700,wordBreak:"break-all"}}>{record.original_name}</p>
        <p style={{fontSize:"clamp(10px,2.8vw,12px)",color:"var(--muted)",marginBottom:16}}>{formatSize(record.size)} · {timeAgo(record.created_at)}</p>
        <div className="opt-list">
          {[
            { label:"View File",   sub:"Preview in app",      color:"teal",   icon:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,  fn: onView },
            { label:"Download",    sub:"Save to device",       color:"blue",   icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>, fn: () => { onDownload(record); onClose(); } },
            { label:"Share Link",  sub:"Copy shareable URL",   color:"violet", icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>, fn: async () => { try { const url = await getFileUrl(record); await navigator.clipboard.writeText(url); } catch {} onClose(); } },
            { label:"Delete File", sub:"Remove permanently",   color:"rose",   icon:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>, fn: onDelete, danger: true },
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

/* ── UPLOAD SHEET (multi-file) ── */
function UploadSheet({ onClose, userId, onUploaded, showToast }) {
  const [queue,  setQueue]  = useState([]);
  const [busy,   setBusy]   = useState(false);
  const [current, setCurrent] = useState("");
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

  const removeFromQueue = (idx) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadAll = async () => {
    if (queue.length === 0) return;
    setBusy(true);
    setDoneCount(0);
    let done = 0;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === "done") { done++; continue; }
      setCurrent(item.file.name);
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "uploading" } : q));
      try {
        await uploadFile(item.file, userId);
        done++;
        setDoneCount(done);
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "done" } : q));
      } catch (e) {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: "error", error: e.message } : q));
      }
    }
    setBusy(false);
    setCurrent("");
    showToast(`✅ ${done} file${done !== 1 ? "s" : ""} uploaded!`);
    onUploaded();
    setTimeout(() => onClose(), 700);
  };

  const pendingCount = queue.filter(q => q.status === "pending" || q.status === "error").length;
  const totalCount   = queue.length;

  const statusIcon = (s) => {
    if (s === "pending")   return <span style={{color:"#9ca3af"}}>○</span>;
    if (s === "uploading") return <span className="spin spin-teal" style={{width:14,height:14,borderWidth:2}}/>;
    if (s === "done")      return <span style={{color:"#059669"}}>✓</span>;
    if (s === "error")     return <span style={{color:"#e11d48"}}>✕</span>;
  };

  return (
    <div className="overlay" onClick={!busy ? onClose : undefined}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <p className="sheet-title">Upload Files</p>
        {!busy && (
          <div className="upload-opts" style={{marginBottom: queue.length ? 16 : 0}}>
            {[
              { label:"Images",    sub:"Select multiple",  color:"teal",   accept:"image/*",   ref:imgRef, icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
              { label:"Videos",    sub:"Select multiple",  color:"violet", accept:"video/*",   ref:vidRef, icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
              { label:"Documents", sub:"PDF, DOC, ZIP…",   color:"blue",   accept:".pdf,.doc,.docx,.txt,.xlsx,.pptx,.zip", ref:docRef, icon:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
              { label:"Any File",  sub:"All types",        color:"rose",   accept:"*",         ref:null,   icon:<><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></> },
            ].map((o, i) => (
              <div key={i} className="upload-opt" onClick={() => {
                if (o.ref) { o.ref.current.click(); return; }
                const inp = document.createElement("input");
                inp.type = "file"; inp.accept = o.accept; inp.multiple = true;
                inp.onchange = e => addFiles(e.target.files);
                inp.click();
              }}>
                {o.ref && <input ref={o.ref} type="file" accept={o.accept} multiple style={{display:"none"}} onChange={e => addFiles(e.target.files)}/>}
                <div className={`upload-opt-icon qa-icon ${o.color}`}>
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{o.icon}</svg>
                </div>
                <span className="upload-opt-label">{o.label}</span>
                <span className="upload-opt-sub">{o.sub}</span>
              </div>
            ))}
          </div>
        )}

        {queue.length > 0 && (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:"clamp(12px,3vw,13px)",fontWeight:700,color:"var(--text)"}}>
                {totalCount} file{totalCount !== 1 ? "s" : ""} selected
              </span>
              {!busy && (
                <span style={{fontSize:12,color:"var(--teal2)",fontWeight:600,cursor:"pointer"}} onClick={() => setQueue([])}>
                  Clear all
                </span>
              )}
            </div>
            {busy && current && (
              <div className="prog-bar-wrap" style={{marginBottom:12}}>
                <div className="prog-bar-label">
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{current}</span>
                  <span>{doneCount}/{totalCount}</span>
                </div>
                <div className="prog-bar-track">
                  <div className="prog-bar-fill" style={{width:`${Math.round((doneCount / totalCount) * 100)}%`}}/>
                </div>
              </div>
            )}
            <div className="queue-list">
              {queue.map((item, i) => (
                <div className="queue-item" key={i}>
                  <span className="queue-item-status">{statusIcon(item.status)}</span>
                  <span className="queue-item-name">{item.file.name}</span>
                  <span className="queue-item-size">{formatSize(item.file.size)}</span>
                  {!busy && item.status !== "done" && (
                    <button className="queue-remove" onClick={() => removeFromQueue(i)}>×</button>
                  )}
                </div>
              ))}
            </div>
            {!busy && pendingCount > 0 && (
              <button className="upload-all-btn" onClick={uploadAll}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}
              </button>
            )}
          </>
        )}

        {queue.length === 0 && (
          <p style={{textAlign:"center",fontSize:"clamp(11px,3vw,13px)",color:"var(--muted)",marginTop:8}}>
            Select files above to add them to the queue
          </p>
        )}
      </div>
    </div>
  );
}

/* ── IMAGE THUMB ── */
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

/* ── HOME BODY ── */
function HomeBody({ userId, showToast, onUploadDone, refreshKey }) {
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUp, setShowUp]   = useState(false);
  const [viewer, setViewer]   = useState(null);
  const [opts,   setOpts]     = useState(null);
  const mcColors = ["mc1","mc2","mc3","mc4","mc5","mc6"];

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchFiles(userId);
    setFiles(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (record) => {
    setOpts(null);
    try { await deleteFile(record); showToast("🗑️ File deleted"); load(); onUploadDone(); }
    catch (e) { showToast("❌ " + e.message); }
  };

  const imageFiles = files.filter(f => f.category === "images").slice(0, 6);

  return (
    <>
      <div className="home-body">
        <div className="sheet-pill"/>
        <div className="sec-hdr"><span className="sec-title">Quick Actions</span></div>
        <div className="qa-grid">
          {[
            { c:"teal",   l:"Upload", fn:() => setShowUp(true), icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> },
            { c:"blue",   l:"Photos", fn:() => showToast("📷 Use Files tab to browse"), icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
            { c:"violet", l:"Videos", fn:() => showToast("🎬 Use Files tab to browse"), icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
            { c:"rose",   l:"Share",  fn:() => showToast("📁 Open a file to share it"), icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> },
          ].map((a,i) => (
            <div className="qa-btn" key={i} onClick={a.fn}>
              <div className={`qa-icon ${a.c}`}><svg viewBox="0 0 24 24">{a.icon}</svg></div>
              <span className="qa-label">{a.l}</span>
            </div>
          ))}
        </div>

        <div className="sec-hdr" style={{marginTop:4}}>
          <span className="sec-title">Recent Files</span>
          <span className="sec-link">See All</span>
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

        <div className="sec-hdr"><span className="sec-title">Media Gallery</span><span className="sec-link">See All</span></div>
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

/* ── FILES BODY ── */
function FilesBody({ userId, showToast, refreshKey, onUploadDone }) {
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");
  const [query,   setQuery]   = useState("");
  const [viewer,  setViewer]  = useState(null);
  const [opts,    setOpts]    = useState(null);
  const [showUp,  setShowUp]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchFiles(userId, filter === "all" ? null : filter);
    setFiles(data);
    setLoading(false);
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

/* ── GALLERY BODY ── */
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

/* ── PROFILE BODY ── */
// CHANGED: logout button now opens LogoutConfirm sheet instead of logging out immediately
function ProfileBody({ user, userId, onLogout, showToast, refreshKey }) {
  const [profile,      setProfile]      = useState(null);
  const [fileCount,    setFileCount]    = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    fetchProfile(userId).then(p => setProfile(p));
    fetchFiles(userId).then(f => setFileCount(f.length));
  }, [userId, refreshKey]);

  const usedPct = profile ? Math.min((profile.storage_used / profile.storage_limit) * 100, 100).toFixed(1) : 0;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const nameParts = displayName.trim().split(" ");

  return (
    <div className="home-page prof-page">
      <div className="prof-hdr">
        <div className="prof-avatar"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <p className="prof-name">{nameParts[0]} <span style={{color:"var(--tl)"}}>{nameParts.slice(1).join(" ")}</span></p>
        <p className="prof-email">{user?.email}</p>
      </div>
      <div className="prof-body">
        <div className="sheet-pill"/>
        <div className="prof-stats">
          {[[fileCount.toString(),"Files"],[profile?formatGB(profile.storage_used):"—","Used"],[profile?`${usedPct}%`:"—","Full"]].map(([v,l]) => (
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
            { icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>, label:"Edit Profile", sub:"Update name & email", color:"teal" },
            { icon:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>, label:"Privacy & Security", sub:"Password, 2FA", color:"blue" },
            { icon:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>, label:"Notifications", sub:"Manage alerts", color:"violet" },
            { icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>, label:"Storage Plan", sub:"Upgrade to 1 TB", color:"rose" },
            { icon:<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></>, label:"Help & Support", sub:"Get help anytime", color:"amber" },
          ].map((m,i) => (
            <div className="menu-row" key={i} onClick={() => showToast(`⚙️ Opening ${m.label}…`)}>
              <div className={`menu-row-icon qa-icon ${m.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{m.icon}</svg></div>
              <div className="menu-row-info"><p className="menu-row-title">{m.label}</p><p className="menu-row-sub">{m.sub}</p></div>
              <span className="menu-row-arrow">›</span>
            </div>
          ))}
        </div>
        {/* CHANGED: triggers confirmation sheet instead of logging out directly */}
        <div className="logout-row">
          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>Log Out</button>
        </div>
      </div>

      {/* CHANGED: logout confirmation sheet */}
      {showLogoutConfirm && (
        <LogoutConfirm
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={onLogout}
        />
      )}
    </div>
  );
}

/* ── HOME PAGE ── */
function HomePage({ user, onLogout }) {
  const [nav,     setNav]     = useState("home");
  const [toast,   setToast]   = useState("");
  const [profile, setProfile] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [showUp,  setShowUp]  = useState(false);
  const userId = user.id;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };
  const onUploadDone = () => setRefresh(r => r + 1);

  useEffect(() => { fetchProfile(userId).then(p => setProfile(p)); }, [userId, refresh]);

  const usedPct = profile ? Math.min((profile.storage_used / profile.storage_limit) * 100, 100) : 0;
  const displayName = (profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User").trim().split(" ");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const navL = [
    { id:"home",  label:"Home",  icon:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { id:"files", label:"Files", icon:<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></> },
  ];
  const navR = [
    { id:"gallery", label:"Gallery", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
    { id:"profile", label:"Profile", icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  ];

  return (
    <div className="home-page">
      {nav !== "profile" && (
        <div className="home-header">
          <div className="hdr-row">
            <div className="hdr-brand">
              <div className="hdr-brand-icon"><CloudIcon/></div>
              <span className="hdr-brand-name">Cloud<span>Vault</span></span>
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

      {nav==="home"    && <HomeBody    userId={userId} showToast={showToast} onUploadDone={onUploadDone} refreshKey={refresh}/>}
      {nav==="files"   && <FilesBody   userId={userId} showToast={showToast} onUploadDone={onUploadDone} refreshKey={refresh}/>}
      {nav==="gallery" && <GalleryBody userId={userId} showToast={showToast} refreshKey={refresh}/>}
      {nav==="profile" && <ProfileBody user={user} userId={userId} onLogout={onLogout} showToast={showToast} refreshKey={refresh}/>}

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
            <div className={`nav-icon-wrap ${nav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${nav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}
      </div>

      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={() => { onUploadDone(); }} showToast={showToast}/>}
    </div>
  );
}

/* ── ROOT ── */
export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); };

  if (user === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div className="cv-app">
          <div className="page-loader">
            <div className="page-loader-inner">
              <div className="spin" style={{width:36,height:36,borderWidth:3,borderColor:"rgba(0,201,167,0.2)",borderTopColor:"var(--teal)"}}/>
              <span>CloudVault</span>
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
        {!user ? <AuthPage onAuth={u => setUser(u)}/> : <HomePage user={user} onLogout={handleLogout}/>}
      </div>
    </>
  );
}
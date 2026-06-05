// ═══════════════════════════════════════════════════════════════
//  ZHARMVAULT — PATCH NOTES
//  Drop these replacements into your existing App.jsx
//  Changes:
//   1. URL cache (in-memory Map) — avoids re-fetching signed URLs
//   2. localStorage metadata cache — files load instantly offline
//   3. Recent Files shows real image/video thumbnails
//   4. VideoThumb component for video previews
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

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

/* ════════════════════════════════
   ① URL CACHE — avoids re-fetching signed URLs
   Keyed by record.id, expires after 50 min (signed URLs last 60 min)
════════════════════════════════ */
const urlCache = new Map(); // id → { url, expiresAt }
const URL_TTL  = 50 * 60 * 1000; // 50 minutes

async function getCachedUrl(record) {
  const cached = urlCache.get(record.id);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  let url;
  if (record.storage_provider === "gdrive") {
    url = record.gdrive_download_link;
  } else if (record.bucket === "images") {
    const { data } = supabase.storage.from("images").getPublicUrl(record.storage_path);
    url = data.publicUrl;
  } else {
    const { data, error } = await supabase.storage.from(record.bucket).createSignedUrl(record.storage_path, 3600);
    if (error) throw error;
    url = data.signedUrl;
  }

  urlCache.set(record.id, { url, expiresAt: Date.now() + URL_TTL });
  return url;
}

/* ════════════════════════════════
   ② METADATA CACHE — localStorage
   Stores file list per user so the UI renders immediately on revisit
════════════════════════════════ */
const LS_PREFIX = "zv_files_";
const LS_PROFILE_PREFIX = "zv_profile_";

function lsKey(userId, category) {
  return LS_PREFIX + userId + (category ? "_" + category : "_all");
}
function lsProfileKey(userId) {
  return LS_PROFILE_PREFIX + userId;
}

function saveFilesCache(userId, category, files) {
  try {
    localStorage.setItem(lsKey(userId, category), JSON.stringify({ ts: Date.now(), files }));
  } catch (e) { /* quota exceeded, ignore */ }
}
function loadFilesCache(userId, category) {
  try {
    const raw = localStorage.getItem(lsKey(userId, category));
    if (!raw) return null;
    const { files } = JSON.parse(raw);
    return files || null;
  } catch { return null; }
}
function saveProfileCache(userId, profile) {
  try { localStorage.setItem(lsProfileKey(userId), JSON.stringify(profile)); } catch {}
}
function loadProfileCache(userId) {
  try {
    const raw = localStorage.getItem(lsProfileKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ── STORAGE OPS (updated to invalidate cache on mutation) ── */
async function uploadFile(file, userId) {
  const bucket = getBucket(file);
  const ext    = file.name.split(".").pop();
  const path   = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from("files").insert({
    user_id: userId, name: file.name, original_name: file.name,
    bucket, storage_path: path, size: file.size, mime_type: file.type,
    category: getCategory(file), storage_provider: "supabase",
  });
  if (dbErr) throw dbErr;
  const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", userId).single();
  if (prof) {
    await supabase.from("profiles").update({ storage_used: (prof.storage_used || 0) + file.size }).eq("id", userId);
  }
  // Invalidate cache so next load is fresh
  ["all","images","videos","docs"].forEach(cat => {
    try { localStorage.removeItem(lsKey(userId, cat)); } catch {}
  });
  try { localStorage.removeItem(lsProfileKey(userId)); } catch {}
}

async function getFileUrl(record) {
  return getCachedUrl(record);
}

async function downloadFile(record) {
  const url = await getCachedUrl(record);
  const a = document.createElement("a");
  a.href = url; a.download = record.original_name; a.target = "_blank"; a.click();
}

async function deleteFile(record) {
  if (record.storage_provider === "gdrive") {
    await supabase.from("files").delete().eq("id", record.id);
  } else {
    await supabase.storage.from(record.bucket).remove([record.storage_path]);
    await supabase.from("files").delete().eq("id", record.id);
  }
  const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", record.user_id).single();
  if (prof) {
    const newUsed = Math.max(0, (prof.storage_used || 0) - (record.size || 0));
    await supabase.from("profiles").update({ storage_used: newUsed }).eq("id", record.user_id);
  }
  // Remove from URL cache
  urlCache.delete(record.id);
  // Invalidate ls cache
  ["all","images","videos","docs"].forEach(cat => {
    try { localStorage.removeItem(lsKey(record.user_id, cat)); } catch {}
  });
}

/* ③ Updated fetchFiles — stale-while-revalidate */
async function fetchFiles(userId, category) {
  let q = supabase.from("files").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  const files = data || [];
  saveFilesCache(userId, category || null, files);
  return files;
}

/* ④ Updated fetchProfile — stale-while-revalidate */
async function fetchProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (data) saveProfileCache(userId, data);
  return data;
}

/* ── ADMIN OPS (unchanged) ── */
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
      if (f.storage_provider !== "gdrive") {
        await supabase.storage.from(f.bucket).remove([f.storage_path]);
      }
      urlCache.delete(f.id);
    }
    await supabase.from("files").delete().eq("user_id", id);
  }
  await supabase.from("profiles").delete().eq("id", id);
}
async function adminCreateUser({ full_name, email, password, storage_limit, is_admin }) {
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email, password,
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
   STYLES  (add only the new/changed rules — paste after your existing styles string)
══════════════════════════════════ */
const extraStyles = `
/* ── Thumbnail in Recent Files ── */
.file-thumb-preview {
  width: clamp(40px,12vw,50px);
  height: clamp(40px,12vw,50px);
  border-radius: clamp(10px,3vw,14px);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
}
.file-thumb-preview img,
.file-thumb-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
  border-radius: clamp(10px,3vw,14px);
}
.file-thumb-preview .ft-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: clamp(10px,3vw,14px);
}
/* video play badge */
.vid-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: rgba(0,0,0,0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vid-badge svg {
  width: 8px;
  height: 8px;
  fill: #fff;
  stroke: none;
}
/* shimmer for loading thumbs */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.thumb-shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
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
   ⑤ FileThumbnailPreview
   Shows real image/video preview in Recent Files.
   Uses the URL cache so it's instant on revisit.
════════════════════════════════ */
function FileThumbnailPreview({ record }) {
  const type = getFileType(record.category);
  const [url, setUrl]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]  = useState(false);

  useEffect(() => {
    if (type === "doc") { setLoading(false); return; }
    let cancelled = false;
    getCachedUrl(record)
      .then(u => { if (!cancelled) { setUrl(u); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [record.id]);

  // Document: icon only
  if (type === "doc") {
    return (
      <div className="file-thumb ft-doc" style={{width:"clamp(40px,12vw,50px)",height:"clamp(40px,12vw,50px)",borderRadius:"clamp(10px,3vw,14px)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <FileThumb type="doc"/>
      </div>
    );
  }

  // Loading shimmer
  if (loading) {
    return (
      <div className="file-thumb-preview thumb-shimmer"/>
    );
  }

  // Failed or no URL: fallback to icon
  if (failed || !url) {
    return (
      <div className={`file-thumb ft-${type}`} style={{width:"clamp(40px,12vw,50px)",height:"clamp(40px,12vw,50px)",borderRadius:"clamp(10px,3vw,14px)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <FileThumb type={type}/>
      </div>
    );
  }

  // Image preview
  if (type === "img") {
    return (
      <div className="file-thumb-preview">
        <img
          src={url}
          alt={record.original_name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  // Video preview — shows first frame via poster trick
  return (
    <div className="file-thumb-preview">
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0,borderRadius:"clamp(10px,3vw,14px)"}}
        onError={() => setFailed(true)}
      />
      {/* play badge overlay */}
      <div className="vid-badge">
        <svg viewBox="0 0 8 8"><polygon points="2,1 7,4 2,7"/></svg>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   ImageThumb (gallery grid — unchanged but now uses cache)
════════════════════════════════ */
function ImageThumb({ record }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    getCachedUrl(record).then(setUrl).catch(() => {});
  }, [record.id]);
  return url
    ? <img src={url} alt={record.original_name} loading="lazy"/>
    : <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}

/* ════════════════════════════════
   ⑥ HomeBody — stale-while-revalidate + thumbnail previews
════════════════════════════════ */
function HomeBody({ userId, showToast, onUploadDone, refreshKey, onNavigate }) {
  // Seed from cache immediately so UI is instant
  const [files, setFiles]     = useState(() => loadFilesCache(userId, null) || []);
  const [loading, setLoading] = useState(files.length === 0); // only spinner if truly empty
  const [showUp, setShowUp]   = useState(false);
  const [viewer, setViewer]   = useState(null);
  const [opts,   setOpts]     = useState(null);
  const mcColors = ["mc1","mc2","mc3","mc4","mc5","mc6"];

  const load = useCallback(async () => {
    try {
      const data = await fetchFiles(userId);
      setFiles(data);
    } catch (e) {
      // If offline and we already have cached data, silently ignore
      if (files.length === 0) showToast("⚠️ Offline — showing cached files");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("home-files-" + userId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "files",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setFiles(prev => {
            const next = [payload.new, ...prev];
            saveFilesCache(userId, null, next);
            return next;
          });
        } else if (payload.eventType === "DELETE") {
          setFiles(prev => {
            const next = prev.filter(f => f.id !== payload.old.id);
            saveFilesCache(userId, null, next);
            return next;
          });
        } else if (payload.eventType === "UPDATE") {
          setFiles(prev => {
            const next = prev.map(f => f.id === payload.new.id ? payload.new : f);
            saveFilesCache(userId, null, next);
            return next;
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId]);

  const handleDelete = async (record) => {
    setOpts(null);
    try { await deleteFile(record); showToast("🗑️ File deleted"); onUploadDone(); }
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
            { c:"teal",   l:"Upload",  fn:() => setShowUp(true),          icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> },
            { c:"blue",   l:"Photos",  fn:() => onNavigate("files"),      icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
            { c:"violet", l:"Videos",  fn:() => onNavigate("files"),      icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
            { c:"rose",   l:"Gallery", fn:() => onNavigate("gallery"),    icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> },
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
          <div style={{display:"flex",justifyContent:"center",padding:"24px 0"}}>
            <div className="spin spin-teal" style={{width:28,height:28}}/>
          </div>
        ) : files.length === 0 ? (
          <div className="empty" style={{padding:"20px 0"}}>
            <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
            <h3>No files yet</h3>
            <p>Tap Upload to add your first file</p>
          </div>
        ) : (
          <div className="file-list">
            {files.slice(0, 4).map(f => (
              <div className="file-row" key={f.id} onClick={() => setViewer(f)}>
                {/* ← THUMBNAIL PREVIEW instead of icon */}
                <FileThumbnailPreview record={f}/>
                <div className="file-info">
                  <p className="file-name">{f.original_name}</p>
                  <p className="file-meta">{timeAgo(f.created_at)}</p>
                </div>
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
              <div className={`media-cell ${mcColors[i%6]}`} key={f.id} onClick={() => setViewer(f)}>
                <ImageThumb record={f}/>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={() => onUploadDone()} showToast={showToast}/>}
      {viewer  && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
      {opts    && <FileOptions record={opts} onClose={() => setOpts(null)} onView={() => { setViewer(opts); setOpts(null); }} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); setOpts(null); }} onDelete={() => handleDelete(opts)}/>}
    </>
  );
}

/* ════════════════════════════════
   ⑦ FilesBody — stale-while-revalidate
════════════════════════════════ */
function FilesBody({ userId, showToast, refreshKey, onUploadDone }) {
  const [filter, setFilter]   = useState("all");
  const [files, setFiles]     = useState(() => loadFilesCache(userId, null) || []);
  const [loading, setLoading] = useState(files.length === 0);
  const [query, setQuery]     = useState("");
  const [viewer, setViewer]   = useState(null);
  const [opts, setOpts]       = useState(null);
  const [showUp, setShowUp]   = useState(false);

  const load = useCallback(async () => {
    const cached = loadFilesCache(userId, filter === "all" ? null : filter);
    if (cached) { setFiles(cached); setLoading(false); }
    else setLoading(true);
    try {
      const data = await fetchFiles(userId, filter === "all" ? null : filter);
      setFiles(data);
    } catch (e) {
      if (!cached) showToast("⚠️ Offline — showing cached files");
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("files-body-" + userId + "-" + filter)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "files",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newFile = payload.new;
          const matchesFilter = filter === "all" || newFile.category === filter;
          if (matchesFilter) setFiles(prev => [newFile, ...prev]);
        } else if (payload.eventType === "DELETE") {
          setFiles(prev => prev.filter(f => f.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          setFiles(prev => prev.map(f => f.id === payload.new.id ? payload.new : f));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, filter]);

  const visible = files.filter(f => f.original_name.toLowerCase().includes(query.toLowerCase()));

  const handleDelete = async (record) => {
    setOpts(null);
    try { await deleteFile(record); showToast("🗑️ File deleted"); onUploadDone(); }
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
          <div style={{display:"flex",justifyContent:"center",padding:"32px 0"}}>
            <div className="spin spin-teal" style={{width:32,height:32}}/>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
            <h3>No files found</h3>
            <p>{query ? "Try a different search term" : "Upload your first file"}</p>
          </div>
        ) : (
          <div className="file-list">
            {visible.map(f => (
              <div className="file-row" key={f.id} onClick={() => setViewer(f)}>
                {/* Thumbnails in All Files too */}
                <FileThumbnailPreview record={f}/>
                <div className="file-info">
                  <p className="file-name">{f.original_name}</p>
                  <p className="file-meta">{timeAgo(f.created_at)} · {formatSize(f.size)}</p>
                </div>
                <span className="file-dots" onClick={e => { e.stopPropagation(); setOpts(f); }}>···</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showUp && <UploadSheet onClose={() => setShowUp(false)} userId={userId} onUploaded={() => onUploadDone()} showToast={showToast}/>}
      {viewer  && <FileViewer record={viewer} onClose={() => setViewer(null)} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); }}/>}
      {opts    && <FileOptions record={opts} onClose={() => setOpts(null)} onView={() => { setViewer(opts); setOpts(null); }} onDownload={r => { downloadFile(r); showToast("⬇️ Downloading…"); setOpts(null); }} onDelete={() => handleDelete(opts)}/>}
    </>
  );
}

/* ════════════════════════════════
   HOW TO INTEGRATE — READ THIS
   ════════════════════════════════

   1. REPLACE your existing App.jsx with this file's content,
      then add the REST of your unchanged components below
      (LogoutConfirm, DeleteConfirmSheet, AuthPage, FileViewer,
       FileOptions, UploadSheet, GalleryBody, ProfileBody,
       EditProfileSheet, PrivacySecuritySheet, HelpSupportSheet,
       AdminPage, AdminUsersTab, AdminFilesTab, EditUserSheet,
       HomePage, root App export).

   2. In your <style> tag / styles string, APPEND extraStyles:
         const allStyles = styles + extraStyles;
      and use <style>{allStyles}</style> in your root render.

   3. The following components are REPLACED in this file —
      do NOT keep the old versions:
        • fetchFiles        (now saves to localStorage)
        • fetchProfile      (now saves to localStorage)
        • getFileUrl        (now uses URL cache)
        • uploadFile        (now invalidates cache on upload)
        • deleteFile        (now invalidates cache on delete)
        • ImageThumb        (now uses getCachedUrl)
        • HomeBody          (seeds from cache + thumbnails)
        • FilesBody         (seeds from cache + thumbnails)

   4. New components added (keep these):
        • FileThumbnailPreview  — real img/video in file rows
        • getCachedUrl          — in-memory URL cache
        • saveFilesCache / loadFilesCache — localStorage helpers
        • saveProfileCache / loadProfileCache

   HOW THE OFFLINE CACHE WORKS:
   ─────────────────────────────
   • On first load: fetches from Supabase, saves to localStorage
   • On revisit (even offline): renders from localStorage instantly,
     then fetches fresh data in background (stale-while-revalidate)
   • Signed URLs (videos/docs) are cached in memory for 50 min
   • Public URLs (images) are always fast (no signed URL needed)
   • Cache is invalidated on upload/delete automatically

   LIMITATIONS:
   ─────────────────────────────
   • Video thumbnails show the first frame only (browser extracts it)
   • Signed URL cache is in-memory only — clears on page refresh
     (images stay fast because they use public URLs)
   • localStorage has ~5MB quota; very large file lists may not cache

*/

// The components below are UNCHANGED from your original — keep them as-is.
// (GalleryBody, ProfileBody, AdminPage, etc.)
import { useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { margin: 0; }

  .cv-app {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    background: #fff;
    overflow-x: hidden;
  }

  /* ══════════════════════════════
     LOGIN PAGE
  ══════════════════════════════ */

  .login-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  /* Teal hero top */
  .login-hero {
    background: linear-gradient(150deg, #00D4B8 0%, #00B5C8 55%, #0094B0 100%);
    padding: 52px 28px 52px;
    position: relative;
    overflow: hidden;
    flex: 0 0 auto;
    min-height: 260px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .login-hero::before {
    content: '';
    position: absolute;
    width: 320px; height: 320px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.13);
    top: -80px; right: -80px;
  }

  .login-hero::after {
    content: '';
    position: absolute;
    width: 200px; height: 200px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.09);
    top: 40px; right: 60px;
  }

  /* Curly deco lines top-right like reference */
  .hero-deco {
    position: absolute;
    top: 18px; right: 18px;
    opacity: 0.18;
  }

  .hero-deco svg { width: 90px; height: 90px; stroke: #fff; fill: none; stroke-width: 1.5; }

  /* Gear icons bottom-left like reference */
  .hero-gears {
    position: absolute;
    bottom: 20px; left: -10px;
    opacity: 0.15;
  }

  .hero-gears svg { width: 110px; height: 110px; stroke: #fff; fill: none; stroke-width: 1.2; }

  .login-hero-text h1 {
    font-family: 'Nunito', sans-serif;
    font-size: 30px;
    font-weight: 900;
    color: #fff;
    line-height: 1.25;
    position: relative;
    z-index: 2;
  }

  .login-hero-text h1 .accent { color: #7FFFD4; }

  /* White card bottom */
  .login-card {
    background: #fff;
    border-radius: 28px 28px 0 0;
    padding: 32px 28px 40px;
    margin-top: -20px;
    flex: 1;
    position: relative;
    z-index: 3;
    box-shadow: 0 -6px 30px rgba(0,0,0,0.06);
  }

  .login-card-title {
    font-family: 'Nunito', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 6px;
  }

  .login-card-sub {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 28px;
  }

  .login-card-sub a {
    color: #00A888;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
  }

  /* Input fields - pill style like reference */
  .cv-field {
    margin-bottom: 16px;
  }

  .cv-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    background: #f5f6f8;
    border-radius: 99px;
    border: 1.5px solid #f0f1f3;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .cv-input-wrap:focus-within {
    border-color: #00C9A7;
    box-shadow: 0 0 0 3px rgba(0,201,167,0.1);
    background: #fff;
  }

  .cv-input-wrap .field-icon {
    position: absolute;
    left: 18px;
    width: 18px; height: 18px;
    stroke: #b0b5be; fill: none; stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
    pointer-events: none;
    flex-shrink: 0;
  }

  .cv-input {
    width: 100%;
    padding: 16px 18px 16px 48px;
    border: none;
    background: transparent;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    color: #111827;
    outline: none;
    border-radius: 99px;
  }

  .cv-input::placeholder { color: #b0b5be; }

  .cv-eye {
    position: absolute;
    right: 18px;
    cursor: pointer;
    width: 18px; height: 18px;
    stroke: #b0b5be; fill: none; stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
  }

  /* Remember / Forgot row */
  .cv-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 4px 4px 24px;
  }

  .cv-remember {
    display: flex; align-items: center; gap: 7px;
  }

  .cv-remember input { accent-color: #00C9A7; width: 15px; height: 15px; }
  .cv-remember span { font-size: 13px; color: #6b7280; }

  .cv-forgot {
    font-size: 13px;
    color: #00A888;
    font-weight: 600;
    cursor: pointer;
  }

  /* Main CTA button - pill */
  .cv-btn-main {
    width: 100%;
    padding: 17px;
    background: linear-gradient(135deg, #00D4B8 0%, #0097B2 100%);
    border: none;
    border-radius: 99px;
    font-family: 'Nunito', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    letter-spacing: 0.3px;
    transition: opacity 0.2s, transform 0.1s;
    margin-bottom: 22px;
    box-shadow: 0 6px 22px rgba(0,180,160,0.35);
  }

  .cv-btn-main:hover { opacity: 0.92; }
  .cv-btn-main:active { transform: scale(0.98); }

  /* Divider */
  .cv-divider {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 20px;
  }

  .cv-divider-line { flex: 1; height: 1px; background: #eef0f2; }
  .cv-divider span { font-size: 12px; color: #b0b5be; white-space: nowrap; }

  /* Social buttons - pill, matching reference exactly */
  .cv-socials {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .cv-social {
    display: flex; align-items: center; justify-content: center;
    gap: 8px;
    padding: 14px;
    border-radius: 99px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    transition: opacity 0.2s, transform 0.1s;
    border: none;
  }

  .cv-social:active { transform: scale(0.97); }

  /* Apple = dark navy like reference */
  .cv-social.apple {
    background: #1a1f2e;
    color: #fff;
  }

  /* Google = white with border like reference */
  .cv-social.google {
    background: #fff;
    color: #374151;
    border: 1.5px solid #e5e7eb;
  }

  /* ══════════════════════════════
     HOME PAGE
  ══════════════════════════════ */

  .home-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f5f7fa;
  }

  /* Teal top header */
  .home-header {
    background: linear-gradient(150deg, #00D4B8 0%, #00B5C8 55%, #0094B0 100%);
    padding: 48px 28px 48px;
    position: relative;
    overflow: hidden;
  }

  .home-header::before {
    content: '';
    position: absolute;
    width: 320px; height: 320px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.1);
    top: -100px; right: -80px;
  }

  .home-header::after {
    content: '';
    position: absolute;
    width: 180px; height: 180px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.08);
    top: 30px; right: 50px;
  }

  .home-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    position: relative;
    z-index: 2;
  }

  .home-brand {
    display: flex; align-items: center; gap: 10px;
  }

  .home-brand-icon {
    width: 38px; height: 38px;
    background: rgba(255,255,255,0.2);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
  }

  .home-brand-icon svg { width: 20px; height: 20px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .home-brand-name {
    font-family: 'Nunito', sans-serif;
    font-size: 19px;
    font-weight: 800;
    color: #fff;
  }

  .home-brand-name span { color: #7FFFD4; }

  .home-notif {
    width: 38px; height: 38px;
    background: rgba(255,255,255,0.18);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    position: relative;
    backdrop-filter: blur(4px);
  }

  .home-notif svg { width: 18px; height: 18px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .notif-dot { position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; background: #FF6B6B; border-radius: 50%; border: 1.5px solid #00B5C8; }

  /* Greeting */
  .home-greeting {
    position: relative;
    z-index: 2;
    margin-bottom: 22px;
  }

  .home-greeting-sub { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 2px; }

  .home-greeting-name {
    font-family: 'Nunito', sans-serif;
    font-size: 27px;
    font-weight: 900;
    color: #fff;
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .home-greeting-name span { color: #7FFFD4; }
  .home-greeting-desc { font-size: 13px; color: rgba(255,255,255,0.7); }

  /* Storage card */
  .storage-card {
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 20px;
    padding: 18px 20px;
    backdrop-filter: blur(10px);
    position: relative;
    z-index: 2;
  }

  .storage-top {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }

  .storage-lbl { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; }
  .storage-amt { font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; color: #7FFFD4; }

  .storage-track { height: 8px; background: rgba(255,255,255,0.18); border-radius: 99px; overflow: visible; margin-bottom: 12px; position: relative; }

  .storage-fill {
    height: 100%;
    width: 62%;
    background: linear-gradient(90deg, #7FFFD4, #fff);
    border-radius: 99px;
    position: relative;
  }

  .storage-fill::after {
    content: '';
    position: absolute;
    right: -4px; top: 50%;
    transform: translateY(-50%);
    width: 14px; height: 14px;
    background: #fff;
    border-radius: 50%;
    border: 2.5px solid #00B5C8;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }

  .storage-types { display: flex; gap: 16px; flex-wrap: wrap; }
  .storage-type-item { display: flex; align-items: center; gap: 6px; }
  .s-dot { width: 8px; height: 8px; border-radius: 50%; }
  .storage-type-item span { font-size: 12px; color: rgba(255,255,255,0.72); }

  /* White body */
  .home-body {
    background: #fff;
    border-radius: 28px 28px 0 0;
    margin-top: -18px;
    padding: 28px 24px 100px;
    flex: 1;
    box-shadow: 0 -6px 24px rgba(0,0,0,0.05);
  }

  .sheet-pill {
    width: 36px; height: 4px;
    background: #e5e7eb;
    border-radius: 99px;
    margin: 0 auto 26px;
  }

  .sec-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }

  .sec-title {
    font-family: 'Nunito', sans-serif;
    font-size: 16px;
    font-weight: 800;
    color: #111827;
  }

  .sec-link { font-size: 13px; color: #00A888; font-weight: 600; cursor: pointer; }

  /* Quick actions */
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 32px;
  }

  .qa-btn {
    display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;
  }

  .qa-icon {
    width: 58px; height: 58px;
    border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
  }

  .qa-icon svg { width: 24px; height: 24px; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }

  .qa-icon.teal   { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .qa-icon.teal svg { stroke: #059669; }
  .qa-icon.blue   { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); }
  .qa-icon.blue svg { stroke: #1D4ED8; }
  .qa-icon.violet { background: linear-gradient(135deg, #EDE9FE, #DDD6FE); }
  .qa-icon.violet svg { stroke: #6D28D9; }
  .qa-icon.rose   { background: linear-gradient(135deg, #FFE4E6, #FECDD3); }
  .qa-icon.rose svg { stroke: #BE123C; }

  .qa-label { font-size: 11px; font-weight: 600; color: #374151; text-align: center; }

  /* Recent files */
  .file-list { margin-bottom: 30px; }

  .file-row {
    display: flex; align-items: center; gap: 14px;
    padding: 13px 0;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
  }

  .file-thumb {
    width: 48px; height: 48px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .file-thumb svg { width: 22px; height: 22px; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .ft-img { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .ft-img svg { stroke: #059669; }
  .ft-vid { background: linear-gradient(135deg, #EDE9FE, #DDD6FE); }
  .ft-vid svg { stroke: #6D28D9; }
  .ft-doc { background: linear-gradient(135deg, #FEF9C3, #FEF08A); }
  .ft-doc svg { stroke: #A16207; }

  .file-info { flex: 1; min-width: 0; }
  .file-name { font-size: 14px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
  .file-meta { font-size: 12px; color: #9ca3af; }
  .file-size { font-size: 12px; font-weight: 600; color: #6b7280; flex-shrink: 0; }

  /* Media gallery grid */
  .media-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .media-cell {
    aspect-ratio: 1;
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    display: flex; align-items: center; justify-content: center;
  }

  .media-cell svg { width: 30px; height: 30px; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; fill: none; opacity: 0.45; }

  .mc1 { background: linear-gradient(135deg, #99F6E4, #5EEAD4); }
  .mc1 svg { stroke: #0F766E; }
  .mc2 { background: linear-gradient(135deg, #C4B5FD, #A78BFA); }
  .mc2 svg { stroke: #4C1D95; }
  .mc3 { background: linear-gradient(135deg, #FED7AA, #FDBA74); }
  .mc3 svg { stroke: #92400E; }
  .mc4 { background: linear-gradient(135deg, #BAE6FD, #7DD3FC); }
  .mc4 svg { stroke: #075985; }
  .mc5 { background: linear-gradient(135deg, #FECDD3, #FDA4AF); }
  .mc5 svg { stroke: #881337; }
  .mc6 { background: linear-gradient(135deg, #D9F99D, #BEF264); }
  .mc6 svg { stroke: #3F6212; }

  .vid-tag {
    position: absolute; bottom: 7px; right: 7px;
    background: rgba(0,0,0,0.42);
    color: #fff; font-size: 9px; font-weight: 700;
    padding: 2px 7px; border-radius: 99px;
    backdrop-filter: blur(4px);
  }

  /* Bottom nav */
  .bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: #fff;
    border-top: 1px solid #f0f1f3;
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 10px 0 20px;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.07);
    z-index: 100;
  }

  .nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer;
  }

  .nav-icon-wrap {
    width: 40px; height: 40px;
    border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }

  .nav-icon-wrap.active { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .nav-icon-wrap svg { width: 20px; height: 20px; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; stroke: #9ca3af; }
  .nav-icon-wrap.active svg { stroke: #059669; }
  .nav-lbl { font-size: 10px; font-weight: 600; color: #9ca3af; }
  .nav-lbl.active { color: #059669; }

  .nav-fab {
    width: 54px; height: 54px;
    background: linear-gradient(135deg, #00D4B8, #0097B2);
    border-radius: 17px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(0,180,160,0.4);
    margin-top: -10px;
    cursor: pointer;
  }

  .nav-fab svg { width: 24px; height: 24px; stroke: #fff; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
`;

const files = [
  { name: "Vacation_Photos.zip", meta: "Today, 2:14 PM", size: "124 MB", type: "img" },
  { name: "Birthday_Video.mp4",  meta: "Yesterday",      size: "312 MB", type: "vid" },
  { name: "Project_Docs.pdf",    meta: "Jun 1",           size: "8.2 MB", type: "doc" },
  { name: "Selfie_Collection.jpg",meta:"May 30",          size: "45 MB",  type: "img" },
];

const mediaGrid = [
  { cls:"mc1", type:"img" }, { cls:"mc2", type:"vid" }, { cls:"mc3", type:"img" },
  { cls:"mc4", type:"img" }, { cls:"mc5", type:"vid" }, { cls:"mc6", type:"img" },
];

function LoginPage({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="login-page">
      {/* Teal hero */}
      <div className="login-hero">
        <div className="hero-deco">
          <svg viewBox="0 0 100 100">
            <path d="M10 50 Q30 10 50 50 Q70 90 90 50" strokeLinecap="round"/>
            <path d="M10 30 Q30 -10 50 30 Q70 70 90 30" strokeLinecap="round"/>
            <path d="M10 70 Q30 30 50 70 Q70 110 90 70" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="hero-gears">
          <svg viewBox="0 0 120 120">
            <circle cx="45" cy="45" r="18"/>
            <circle cx="45" cy="45" r="8"/>
            {[0,45,90,135,180,225,270,315].map(a => {
              const r = a * Math.PI / 180;
              const x1 = 45 + 20*Math.cos(r), y1 = 45 + 20*Math.sin(r);
              const x2 = 45 + 26*Math.cos(r), y2 = 45 + 26*Math.sin(r);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="4" strokeLinecap="round"/>;
            })}
            <circle cx="80" cy="80" r="12"/>
            <circle cx="80" cy="80" r="5"/>
            {[0,60,120,180,240,300].map(a => {
              const r = a * Math.PI / 180;
              const x1 = 80 + 13*Math.cos(r), y1 = 80 + 13*Math.sin(r);
              const x2 = 80 + 18*Math.cos(r), y2 = 80 + 18*Math.sin(r);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="3" strokeLinecap="round"/>;
            })}
          </svg>
        </div>
        <div className="login-hero-text">
          <h1>Log in to stay on<br/><span className="accent">top of</span> your files<br/>and projects.</h1>
        </div>
      </div>

      {/* White card */}
      <div className="login-card">
        <p className="login-card-title">Login</p>
        <p className="login-card-sub">Don't Have An Account? <a onClick={() => {}}>Sign Up</a></p>

        {/* Name */}
        <div className="cv-field">
          <div className="cv-input-wrap">
            <svg className="field-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <input className="cv-input" placeholder="Michael Daniel Harris" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>

        {/* Email */}
        <div className="cv-field">
          <div className="cv-input-wrap">
            <svg className="field-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <input className="cv-input" type="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>

        {/* Remember / Forgot */}
        <div className="cv-row">
          <label className="cv-remember">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>Remember Me</span>
          </label>
          <span className="cv-forgot">Forgot Password?</span>
        </div>

        {/* Login button */}
        <button className="cv-btn-main" onClick={onLogin}>Login</button>

        {/* Divider */}
        <div className="cv-divider">
          <div className="cv-divider-line"/>
          <span>Or Continue With</span>
          <div className="cv-divider-line"/>
        </div>

        {/* Social buttons */}
        <div className="cv-socials">
          <button className="cv-social apple" onClick={onLogin}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple
          </button>
          <button className="cv-social google" onClick={onLogin}>
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage({ onLogout }) {
  const [activeNav, setActiveNav] = useState("home");

  return (
    <div className="home-page">
      {/* Teal header */}
      <div className="home-header">
        <div className="home-header-row">
          <div className="home-brand">
            <div className="home-brand-icon">
              <svg viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
            </div>
            <span className="home-brand-name">Cloud<span>Vault</span></span>
          </div>
          <div className="home-notif" onClick={onLogout} title="Tap to logout">
            <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div className="notif-dot"/>
          </div>
        </div>

        <div className="home-greeting">
          <p className="home-greeting-sub">Good afternoon 👋</p>
          <h2 className="home-greeting-name">Michael <span>Daniel</span></h2>
          <p className="home-greeting-desc">Your files are safe & organized</p>
        </div>

        <div className="storage-card">
          <div className="storage-top">
            <span className="storage-lbl">Storage Used</span>
            <span className="storage-amt">12.4 GB / 20 GB</span>
          </div>
          <div className="storage-track">
            <div className="storage-fill"/>
          </div>
          <div className="storage-types">
            {[["#7FFFD4","Photos 4.2 GB"],["#C4B5FD","Videos 6.8 GB"],["#FDE68A","Docs 1.4 GB"]].map(([c,l]) => (
              <div className="storage-type-item" key={l}>
                <div className="s-dot" style={{background:c}}/>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* White body */}
      <div className="home-body">
        <div className="sheet-pill"/>

        {/* Quick Actions */}
        <div className="sec-header"><span className="sec-title">Quick Actions</span></div>
        <div className="quick-grid">
          {[
            { color:"teal",  label:"Upload", icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> },
            { color:"blue",  label:"Photos", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
            { color:"violet",label:"Videos", icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> },
            { color:"rose",  label:"Share",  icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> },
          ].map((a,i) => (
            <div className="qa-btn" key={i}>
              <div className={`qa-icon ${a.color}`}><svg viewBox="0 0 24 24">{a.icon}</svg></div>
              <span className="qa-label">{a.label}</span>
            </div>
          ))}
        </div>

        {/* Recent Files */}
        <div className="sec-header" style={{marginTop:4}}>
          <span className="sec-title">Recent Files</span>
          <span className="sec-link">See All</span>
        </div>
        <div className="file-list">
          {files.map((f,i) => (
            <div className="file-row" key={i}>
              <div className={`file-thumb ft-${f.type}`}>
                {f.type==="img" && <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                {f.type==="vid" && <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
                {f.type==="doc" && <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              </div>
              <div className="file-info">
                <p className="file-name">{f.name}</p>
                <p className="file-meta">{f.meta}</p>
              </div>
              <span className="file-size">{f.size}</span>
            </div>
          ))}
        </div>

        {/* Media Gallery */}
        <div className="sec-header">
          <span className="sec-title">Media Gallery</span>
          <span className="sec-link">See All</span>
        </div>
        <div className="media-grid">
          {mediaGrid.map((m,i) => (
            <div className={`media-cell ${m.cls}`} key={i}>
              {m.type==="img"
                ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                : <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              }
              {m.type==="vid" && <span className="vid-tag">▶ VID</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
        {[
          { id:"home",    label:"Home",    icon:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
          { id:"files",   label:"Files",   icon:<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></> },
        ].map(n => (
          <div className="nav-item" key={n.id} onClick={() => setActiveNav(n.id)}>
            <div className={`nav-icon-wrap ${activeNav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${activeNav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}

        <div className="nav-fab">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>

        {[
          { id:"gallery", label:"Gallery", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
          { id:"profile", label:"Profile", icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
        ].map(n => (
          <div className="nav-item" key={n.id} onClick={() => setActiveNav(n.id)}>
            <div className={`nav-icon-wrap ${activeNav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${activeNav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("login");
  return (
    <>
      <style>{styles}</style>
      <div className="cv-app">
        {page === "login"
          ? <LoginPage onLogin={() => setPage("home")} />
          : <HomePage onLogout={() => setPage("login")} />
        }
      </div>
    </>
  );
}
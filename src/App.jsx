import { useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow-x: hidden; }

  :root {
    --teal: #00C9A7;
    --teal2: #00A888;
    --teal3: #0097B2;
    --teal-light: #7FFFD4;
    --bg: #f5f7fa;
    --white: #fff;
    --text: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
    --red: #FF6B6B;
    --nunito: 'Nunito', sans-serif;
    --dm: 'DM Sans', sans-serif;
    /* Fluid sizing */
    --r: clamp(12px, 3.5vw, 18px);
  }

  .cv-app {
    font-family: var(--dm);
    min-height: 100%;
    background: var(--bg);
    overflow-x: hidden;
    max-width: 480px;
    margin: 0 auto;
    position: relative;
  }

  /* ══════════════════════
     LOGIN PAGE
  ══════════════════════ */
  .login-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    background: var(--white);
    overflow: hidden;
  }

  /* Teal hero - illustration area */
  .login-hero {
    background: linear-gradient(160deg, #00D4B8 0%, #00B5C8 50%, #0094B0 100%);
    flex: 0 0 auto;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(28px, 8vw, 52px) clamp(20px, 6vw, 40px) clamp(36px, 10vw, 60px);
    min-height: clamp(260px, 45svh, 360px);
  }

  /* Decorative circles */
  .login-hero::before {
    content: '';
    position: absolute;
    width: clamp(180px, 65vw, 320px);
    height: clamp(180px, 65vw, 320px);
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.13);
    top: -20%; right: -15%;
  }
  .login-hero::after {
    content: '';
    position: absolute;
    width: clamp(100px, 40vw, 200px);
    height: clamp(100px, 40vw, 200px);
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.09);
    top: 10%; right: 8%;
  }

  /* SVG illustration */
  .hero-illustration {
    position: relative;
    z-index: 2;
    width: clamp(180px, 60vw, 260px);
    height: clamp(180px, 60vw, 260px);
    flex-shrink: 0;
  }

  /* Card slides up */
  .login-card {
    background: var(--white);
    border-radius: clamp(20px, 6vw, 32px) clamp(20px, 6vw, 32px) 0 0;
    padding: clamp(24px, 6vw, 36px) clamp(20px, 6vw, 32px) clamp(28px, 7vw, 44px);
    margin-top: clamp(-22px, -5vw, -28px);
    flex: 1;
    position: relative;
    z-index: 3;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.07);
  }

  .login-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: clamp(4px, 1.5vw, 8px);
  }

  .login-brand-icon {
    width: clamp(30px, 8vw, 38px);
    height: clamp(30px, 8vw, 38px);
    background: linear-gradient(135deg, var(--teal), var(--teal3));
    border-radius: clamp(8px, 2.5vw, 12px);
    display: flex; align-items: center; justify-content: center;
  }

  .login-brand-icon svg { width: 55%; height: 55%; stroke: #fff; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

  .login-brand-name {
    font-family: var(--nunito);
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 900;
    color: var(--text);
  }

  .login-brand-name span { color: var(--teal2); }

  .login-headline {
    font-family: var(--nunito);
    font-size: clamp(19px, 5.5vw, 26px);
    font-weight: 800;
    color: var(--text);
    text-align: center;
    line-height: 1.25;
    margin-bottom: clamp(4px, 1.5vw, 8px);
  }

  .login-sub {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--muted);
    text-align: center;
    margin-bottom: clamp(20px, 5vw, 30px);
    line-height: 1.5;
    padding: 0 clamp(4px, 2vw, 16px);
  }

  /* Input fields */
  .cv-field { margin-bottom: clamp(12px, 3.5vw, 16px); }

  .cv-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    background: #f5f6f8;
    border-radius: 99px;
    border: 1.5px solid #f0f1f3;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }

  .cv-input-wrap:focus-within {
    border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(0,201,167,0.12);
    background: var(--white);
  }

  .cv-input-wrap .field-icon {
    position: absolute;
    left: clamp(14px, 4vw, 18px);
    width: clamp(15px, 4vw, 18px);
    height: clamp(15px, 4vw, 18px);
    stroke: #b0b5be; fill: none; stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
    pointer-events: none;
  }

  .cv-input {
    width: 100%;
    padding: clamp(13px, 3.8vw, 16px) clamp(14px, 4vw, 18px) clamp(13px, 3.8vw, 16px) clamp(42px, 11vw, 50px);
    border: none;
    background: transparent;
    font-size: clamp(13px, 3.5vw, 15px);
    font-family: var(--dm);
    color: var(--text);
    outline: none;
    border-radius: 99px;
  }

  .cv-input::placeholder { color: #b0b5be; }

  .cv-eye {
    position: absolute;
    right: clamp(14px, 4vw, 18px);
    cursor: pointer;
    width: clamp(15px, 4vw, 18px);
    height: clamp(15px, 4vw, 18px);
    stroke: #b0b5be; fill: none; stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
    padding: 2px;
  }

  .cv-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: clamp(2px, 1vw, 4px) clamp(2px, 1vw, 6px) clamp(18px, 5vw, 24px);
  }

  .cv-remember { display: flex; align-items: center; gap: 6px; }
  .cv-remember input { accent-color: var(--teal); width: 14px; height: 14px; }
  .cv-remember span { font-size: clamp(12px, 3.2vw, 13px); color: var(--muted); }
  .cv-forgot { font-size: clamp(12px, 3.2vw, 13px); color: var(--teal2); font-weight: 600; cursor: pointer; }

  .cv-btn-main {
    width: 100%;
    padding: clamp(14px, 4vw, 17px);
    background: linear-gradient(135deg, var(--teal) 0%, var(--teal3) 100%);
    border: none;
    border-radius: 99px;
    font-family: var(--nunito);
    font-size: clamp(14px, 4vw, 16px);
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    letter-spacing: 0.3px;
    transition: opacity 0.2s, transform 0.12s;
    box-shadow: 0 6px 22px rgba(0,180,160,0.35);
  }

  .cv-btn-main:hover { opacity: 0.93; }
  .cv-btn-main:active { transform: scale(0.98); }

  /* ══════════════════════
     HOME PAGE
  ══════════════════════ */
  .home-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    background: #f5f7fa;
  }

  .home-header {
    background: linear-gradient(150deg, #00D4B8 0%, #00B5C8 55%, #0094B0 100%);
    padding: clamp(36px, 10vw, 52px) clamp(18px, 5vw, 28px) clamp(22px, 6vw, 32px);
    position: relative;
    overflow: hidden;
  }

  .home-header::before {
    content: '';
    position: absolute;
    width: clamp(200px, 70vw, 320px);
    height: clamp(200px, 70vw, 320px);
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.1);
    top: -25%; right: -15%;
  }

  .home-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(18px, 5vw, 28px);
    position: relative;
    z-index: 2;
  }

  .home-brand { display: flex; align-items: center; gap: clamp(7px, 2vw, 10px); }

  .home-brand-icon {
    width: clamp(32px, 9vw, 40px);
    height: clamp(32px, 9vw, 40px);
    background: rgba(255,255,255,0.2);
    border-radius: clamp(9px, 2.5vw, 13px);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
  }

  .home-brand-icon svg { width: 55%; height: 55%; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .home-brand-name {
    font-family: var(--nunito);
    font-size: clamp(15px, 4.5vw, 20px);
    font-weight: 800;
    color: #fff;
  }
  .home-brand-name span { color: var(--teal-light); }

  .home-notif {
    width: clamp(32px, 9vw, 40px);
    height: clamp(32px, 9vw, 40px);
    background: rgba(255,255,255,0.18);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    position: relative;
    backdrop-filter: blur(4px);
  }

  .home-notif svg { width: 55%; height: 55%; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; background: var(--red); border-radius: 50%; border: 1.5px solid #00B5C8; }

  .home-greeting { position: relative; z-index: 2; margin-bottom: clamp(16px, 4.5vw, 24px); }
  .home-greeting-sub { font-size: clamp(11px, 3vw, 13px); color: rgba(255,255,255,0.75); margin-bottom: 2px; }
  .home-greeting-name { font-family: var(--nunito); font-size: clamp(21px, 6.5vw, 28px); font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 3px; }
  .home-greeting-name span { color: var(--teal-light); }
  .home-greeting-desc { font-size: clamp(11px, 3vw, 13px); color: rgba(255,255,255,0.7); }

  /* Storage card */
  .storage-card {
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(14px, 4vw, 18px) clamp(14px, 4.5vw, 20px);
    backdrop-filter: blur(10px);
    position: relative;
    z-index: 2;
  }

  .storage-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: clamp(8px, 2.5vw, 12px); }
  .storage-lbl { font-size: clamp(9px, 2.5vw, 12px); color: rgba(255,255,255,0.7); font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; }
  .storage-amt { font-family: var(--nunito); font-size: clamp(11px, 3vw, 13px); font-weight: 700; color: var(--teal-light); }
  .storage-track { height: clamp(6px, 1.8vw, 8px); background: rgba(255,255,255,0.18); border-radius: 99px; overflow: visible; margin-bottom: clamp(10px, 3vw, 13px); position: relative; }
  .storage-fill { height: 100%; width: 62%; background: linear-gradient(90deg, #7FFFD4, #fff); border-radius: 99px; position: relative; }
  .storage-fill::after { content: ''; position: absolute; right: -4px; top: 50%; transform: translateY(-50%); width: clamp(10px, 3vw, 14px); height: clamp(10px, 3vw, 14px); background: #fff; border-radius: 50%; border: 2px solid #00B5C8; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
  .storage-types { display: flex; gap: clamp(10px, 3vw, 16px); flex-wrap: wrap; }
  .storage-type-item { display: flex; align-items: center; gap: 5px; }
  .s-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .storage-type-item span { font-size: clamp(10px, 2.8vw, 12px); color: rgba(255,255,255,0.72); }

  /* White body */
  .home-body {
    background: var(--white);
    border-radius: clamp(20px, 6vw, 28px) clamp(20px, 6vw, 28px) 0 0;
    margin-top: clamp(-14px, -4vw, -18px);
    padding: clamp(18px, 5vw, 28px) clamp(16px, 5vw, 24px) clamp(90px, 22vw, 110px);
    flex: 1;
    box-shadow: 0 -6px 24px rgba(0,0,0,0.05);
    overflow-x: hidden;
  }

  .sheet-pill { width: 34px; height: 4px; background: var(--border); border-radius: 99px; margin: 0 auto clamp(18px, 5vw, 26px); }

  .sec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: clamp(12px, 3.5vw, 16px); }
  .sec-title { font-family: var(--nunito); font-size: clamp(14px, 4vw, 17px); font-weight: 800; color: var(--text); }
  .sec-link { font-size: clamp(11px, 3vw, 13px); color: var(--teal2); font-weight: 600; cursor: pointer; }

  /* Quick actions */
  .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 2.5vw, 14px); margin-bottom: clamp(22px, 6vw, 32px); }

  .qa-btn { display: flex; flex-direction: column; align-items: center; gap: clamp(5px, 1.5vw, 8px); cursor: pointer; transition: transform 0.15s; }
  .qa-btn:active { transform: scale(0.93); }

  .qa-icon {
    width: clamp(46px, 14vw, 58px);
    height: clamp(46px, 14vw, 58px);
    border-radius: clamp(13px, 4vw, 18px);
    display: flex; align-items: center; justify-content: center;
  }

  .qa-icon svg { width: clamp(20px, 5.5vw, 24px); height: clamp(20px, 5.5vw, 24px); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .qa-icon.teal   { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .qa-icon.teal svg { stroke: #059669; }
  .qa-icon.blue   { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); }
  .qa-icon.blue svg { stroke: #1D4ED8; }
  .qa-icon.violet { background: linear-gradient(135deg, #EDE9FE, #DDD6FE); }
  .qa-icon.violet svg { stroke: #6D28D9; }
  .qa-icon.rose   { background: linear-gradient(135deg, #FFE4E6, #FECDD3); }
  .qa-icon.rose svg { stroke: #BE123C; }
  .qa-icon.amber  { background: linear-gradient(135deg, #FEF9C3, #FEF08A); }
  .qa-icon.amber svg { stroke: #A16207; }
  .qa-icon.sky    { background: linear-gradient(135deg, #E0F2FE, #BAE6FD); }
  .qa-icon.sky svg { stroke: #0369A1; }
  .qa-icon.emerald { background: linear-gradient(135deg, #D1FAE5, #A7F3D0); }
  .qa-icon.emerald svg { stroke: #047857; }
  .qa-icon.slate  { background: linear-gradient(135deg, #F1F5F9, #E2E8F0); }
  .qa-icon.slate svg { stroke: #475569; }

  .qa-label { font-size: clamp(9px, 2.6vw, 11px); font-weight: 600; color: #374151; text-align: center; line-height: 1.2; }

  /* Upload modal overlay */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: flex-end;
    backdrop-filter: blur(3px);
    animation: fadeIn 0.2s ease;
  }

  .modal-sheet {
    background: var(--white);
    border-radius: clamp(20px, 6vw, 28px) clamp(20px, 6vw, 28px) 0 0;
    padding: clamp(20px, 6vw, 28px) clamp(18px, 5vw, 26px) clamp(28px, 8vw, 40px);
    width: 100%;
    animation: slideUp 0.25s ease;
  }

  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }

  .modal-pill { width: 34px; height: 4px; background: var(--border); border-radius: 99px; margin: 0 auto clamp(16px, 4.5vw, 22px); }
  .modal-title { font-family: var(--nunito); font-size: clamp(16px, 4.5vw, 20px); font-weight: 800; color: var(--text); margin-bottom: clamp(14px, 4vw, 20px); }

  .upload-options { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(10px, 3vw, 14px); }

  .upload-opt {
    display: flex; flex-direction: column; align-items: center; gap: clamp(8px, 2.5vw, 11px);
    padding: clamp(14px, 4vw, 20px) clamp(10px, 3vw, 16px);
    border-radius: clamp(14px, 4vw, 18px);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    border: 1.5px solid var(--border);
  }

  .upload-opt:active { transform: scale(0.96); }

  .upload-opt-icon { width: clamp(44px, 12vw, 54px); height: clamp(44px, 12vw, 54px); border-radius: clamp(12px, 3.5vw, 16px); display: flex; align-items: center; justify-content: center; }
  .upload-opt-icon svg { width: 55%; height: 55%; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .upload-opt-label { font-size: clamp(12px, 3.2vw, 14px); font-weight: 600; color: var(--text); }
  .upload-opt-sub { font-size: clamp(10px, 2.8vw, 11px); color: var(--muted); text-align: center; }

  /* Recent Files */
  .file-list { margin-bottom: clamp(22px, 6vw, 30px); }

  .file-row {
    display: flex; align-items: center; gap: clamp(10px, 3vw, 14px);
    padding: clamp(10px, 3vw, 13px) 0;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    transition: background 0.15s;
    border-radius: 8px;
  }

  .file-thumb {
    width: clamp(40px, 12vw, 50px);
    height: clamp(40px, 12vw, 50px);
    border-radius: clamp(10px, 3vw, 14px);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .file-thumb svg { width: clamp(18px, 5vw, 22px); height: clamp(18px, 5vw, 22px); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .ft-img { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .ft-img svg { stroke: #059669; }
  .ft-vid { background: linear-gradient(135deg, #EDE9FE, #DDD6FE); }
  .ft-vid svg { stroke: #6D28D9; }
  .ft-doc { background: linear-gradient(135deg, #FEF9C3, #FEF08A); }
  .ft-doc svg { stroke: #A16207; }

  .file-info { flex: 1; min-width: 0; }
  .file-name { font-size: clamp(12px, 3.5vw, 14px); font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
  .file-meta { font-size: clamp(10px, 2.8vw, 12px); color: #9ca3af; }
  .file-size { font-size: clamp(10px, 2.8vw, 12px); font-weight: 600; color: #6b7280; flex-shrink: 0; }

  /* Three-dot menu on file */
  .file-dots { padding: 4px; cursor: pointer; color: #9ca3af; font-size: 16px; letter-spacing: 1px; flex-shrink: 0; }

  /* Media gallery */
  .media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(6px, 2vw, 8px); }

  .media-cell {
    aspect-ratio: 1;
    border-radius: clamp(10px, 3vw, 14px);
    overflow: hidden;
    cursor: pointer;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s;
  }

  .media-cell:active { transform: scale(0.96); }
  .media-cell svg { width: clamp(22px, 6.5vw, 30px); height: clamp(22px, 6.5vw, 30px); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; fill: none; opacity: 0.45; }
  .mc1 { background: linear-gradient(135deg, #99F6E4, #5EEAD4); } .mc1 svg { stroke: #0F766E; }
  .mc2 { background: linear-gradient(135deg, #C4B5FD, #A78BFA); } .mc2 svg { stroke: #4C1D95; }
  .mc3 { background: linear-gradient(135deg, #FED7AA, #FDBA74); } .mc3 svg { stroke: #92400E; }
  .mc4 { background: linear-gradient(135deg, #BAE6FD, #7DD3FC); } .mc4 svg { stroke: #075985; }
  .mc5 { background: linear-gradient(135deg, #FECDD3, #FDA4AF); } .mc5 svg { stroke: #881337; }
  .mc6 { background: linear-gradient(135deg, #D9F99D, #BEF264); } .mc6 svg { stroke: #3F6212; }

  .vid-tag {
    position: absolute; bottom: 6px; right: 6px;
    background: rgba(0,0,0,0.45); color: #fff;
    font-size: clamp(8px, 2.2vw, 10px); font-weight: 700;
    padding: 2px clamp(5px, 1.5vw, 7px); border-radius: 99px;
    backdrop-filter: blur(4px);
  }

  /* Bottom Nav */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: var(--white);
    border-top: 1px solid #f0f1f3;
    display: flex; justify-content: space-around; align-items: center;
    padding: clamp(8px, 2.5vw, 12px) 0 clamp(14px, 5vw, 22px);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.07);
    z-index: 100;
    max-width: 480px;
    margin: 0 auto;
  }

  .nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; }

  .nav-icon-wrap {
    width: clamp(34px, 9.5vw, 42px);
    height: clamp(34px, 9.5vw, 42px);
    border-radius: clamp(10px, 3vw, 14px);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }

  .nav-icon-wrap.active { background: linear-gradient(135deg, #CFFAF4, #99F6E4); }
  .nav-icon-wrap svg { width: clamp(16px, 4.5vw, 20px); height: clamp(16px, 4.5vw, 20px); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; stroke: #9ca3af; }
  .nav-icon-wrap.active svg { stroke: #059669; }
  .nav-lbl { font-size: clamp(9px, 2.4vw, 11px); font-weight: 600; color: #9ca3af; }
  .nav-lbl.active { color: #059669; }

  .nav-fab {
    width: clamp(46px, 13vw, 56px);
    height: clamp(46px, 13vw, 56px);
    background: linear-gradient(135deg, var(--teal), var(--teal3));
    border-radius: clamp(13px, 4vw, 18px);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 20px rgba(0,180,160,0.4);
    margin-top: -8px;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .nav-fab:active { transform: scale(0.94); }
  .nav-fab svg { width: clamp(20px, 5.5vw, 24px); height: clamp(20px, 5.5vw, 24px); stroke: #fff; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

  /* Profile page */
  .profile-page { padding-bottom: clamp(90px, 22vw, 110px); }
  .profile-header-area { background: linear-gradient(150deg, #00D4B8 0%, #00B5C8 55%, #0094B0 100%); padding: clamp(36px, 10vw, 52px) clamp(18px, 5vw, 28px) clamp(30px, 8vw, 44px); text-align: center; position: relative; }
  .profile-avatar { width: clamp(64px, 18vw, 82px); height: clamp(64px, 18vw, 82px); background: rgba(255,255,255,0.22); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto clamp(10px, 3vw, 14px); border: 2.5px solid rgba(255,255,255,0.5); }
  .profile-avatar svg { width: 55%; height: 55%; stroke: #fff; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .profile-name { font-family: var(--nunito); font-size: clamp(18px, 5.5vw, 24px); font-weight: 900; color: #fff; margin-bottom: 4px; }
  .profile-email { font-size: clamp(11px, 3vw, 13px); color: rgba(255,255,255,0.75); }

  .profile-body { background: var(--white); border-radius: clamp(20px, 6vw, 28px) clamp(20px, 6vw, 28px) 0 0; margin-top: clamp(-14px, -4vw, -18px); padding: clamp(20px, 5.5vw, 28px) clamp(16px, 5vw, 24px); }
  .profile-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(10px, 3vw, 14px); margin-bottom: clamp(22px, 6vw, 30px); }
  .profile-stat { background: #f9fafb; border-radius: clamp(12px, 3.5vw, 16px); padding: clamp(12px, 3.5vw, 16px) clamp(8px, 2.5vw, 12px); text-align: center; }
  .pstat-val { font-family: var(--nunito); font-size: clamp(16px, 4.8vw, 22px); font-weight: 900; color: var(--text); }
  .pstat-lbl { font-size: clamp(9px, 2.5vw, 11px); color: var(--muted); margin-top: 2px; }

  .menu-list { display: flex; flex-direction: column; gap: clamp(2px, 0.8vw, 4px); }
  .menu-row {
    display: flex; align-items: center; gap: clamp(12px, 3.5vw, 16px);
    padding: clamp(13px, 3.8vw, 16px) clamp(8px, 2.5vw, 12px);
    border-radius: clamp(12px, 3.5vw, 16px);
    cursor: pointer;
    transition: background 0.15s;
  }
  .menu-row:hover { background: #f9fafb; }
  .menu-row-icon { width: clamp(36px, 10vw, 44px); height: clamp(36px, 10vw, 44px); border-radius: clamp(10px, 3vw, 13px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .menu-row-icon svg { width: 55%; height: 55%; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .menu-row-info { flex: 1; }
  .menu-row-title { font-size: clamp(13px, 3.6vw, 15px); font-weight: 600; color: var(--text); }
  .menu-row-sub { font-size: clamp(10px, 2.8vw, 12px); color: var(--muted); margin-top: 1px; }
  .menu-row-arrow { color: #d1d5db; font-size: 18px; }

  /* Logout row */
  .logout-row { margin-top: clamp(16px, 4.5vw, 22px); }
  .logout-btn {
    width: 100%; padding: clamp(13px, 3.8vw, 15px);
    background: #fff1f2; border: 1.5px solid #fecdd3;
    border-radius: 99px; font-family: var(--nunito);
    font-size: clamp(13px, 3.8vw, 15px); font-weight: 700;
    color: #e11d48; cursor: pointer;
    transition: opacity 0.2s, transform 0.12s;
  }
  .logout-btn:active { transform: scale(0.98); }

  /* Toast */
  .toast {
    position: fixed; bottom: clamp(76px, 18vw, 90px); left: 50%; transform: translateX(-50%);
    background: #111827; color: #fff;
    font-size: clamp(12px, 3.2vw, 13px); font-weight: 600;
    padding: clamp(9px, 2.5vw, 11px) clamp(16px, 4.5vw, 22px);
    border-radius: 99px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    z-index: 999; white-space: nowrap;
    animation: fadeIn 0.2s ease;
    max-width: 90vw;
  }

  /* Files page filter */
  .filter-row { display: flex; gap: clamp(8px, 2.5vw, 12px); overflow-x: auto; padding-bottom: 4px; margin-bottom: clamp(14px, 4vw, 20px); scrollbar-width: none; }
  .filter-row::-webkit-scrollbar { display: none; }
  .filter-chip {
    flex-shrink: 0; padding: clamp(6px, 2vw, 8px) clamp(12px, 3.5vw, 16px);
    border-radius: 99px; font-size: clamp(11px, 3vw, 13px); font-weight: 600;
    cursor: pointer; transition: all 0.15s;
    border: 1.5px solid var(--border);
    background: var(--white); color: var(--muted);
  }
  .filter-chip.active { background: var(--teal); border-color: var(--teal); color: #fff; box-shadow: 0 3px 10px rgba(0,180,160,0.3); }

  /* Search bar */
  .search-wrap {
    display: flex; align-items: center; gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(16px, 4.5vw, 22px);
  }

  .search-bar {
    flex: 1; display: flex; align-items: center; gap: clamp(8px, 2.5vw, 11px);
    background: #f5f6f8; border-radius: 99px;
    padding: clamp(10px, 3vw, 13px) clamp(14px, 4vw, 18px);
    border: 1.5px solid var(--border);
  }

  .search-bar svg { width: clamp(14px, 4vw, 16px); height: clamp(14px, 4vw, 16px); stroke: #9ca3af; fill: none; stroke-width: 2; stroke-linecap: round; flex-shrink: 0; }
  .search-bar input { border: none; background: transparent; outline: none; font-size: clamp(12px, 3.4vw, 14px); font-family: var(--dm); color: var(--text); width: 100%; }
  .search-bar input::placeholder { color: #b0b5be; }

  .sort-btn { width: clamp(38px, 10.5vw, 46px); height: clamp(38px, 10.5vw, 46px); background: #f5f6f8; border-radius: clamp(11px, 3vw, 14px); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; border: 1.5px solid var(--border); }
  .sort-btn svg { width: 55%; height: 55%; stroke: #6b7280; fill: none; stroke-width: 2; stroke-linecap: round; }
`;

/* ── DATA ── */
const allFiles = [
  { name: "Vacation_Photos.zip",    meta: "Today, 2:14 PM", size: "124 MB", type: "img", cat: "images" },
  { name: "Birthday_Video.mp4",     meta: "Yesterday",       size: "312 MB", type: "vid", cat: "videos" },
  { name: "Project_Docs.pdf",       meta: "Jun 1",            size: "8.2 MB", type: "doc", cat: "docs"   },
  { name: "Selfie_Collection.jpg",  meta: "May 30",           size: "45 MB",  type: "img", cat: "images" },
  { name: "Team_Meeting.mp4",       meta: "May 29",           size: "520 MB", type: "vid", cat: "videos" },
  { name: "Resume_2025.pdf",        meta: "May 28",           size: "1.4 MB", type: "doc", cat: "docs"   },
  { name: "Album_Covers.zip",       meta: "May 27",           size: "88 MB",  type: "img", cat: "images" },
];

const mediaGrid = [
  { cls:"mc1", type:"img" }, { cls:"mc2", type:"vid" }, { cls:"mc3", type:"img" },
  { cls:"mc4", type:"img" }, { cls:"mc5", type:"vid" }, { cls:"mc6", type:"img" },
];

/* ── ICONS ── */
const CloudIcon = () => <svg viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>;
const BellIcon  = () => <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const FileThumb = ({ type }) => {
  if (type === "img") return <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
  if (type === "vid") return <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
  return <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
};

/* ── LOGIN PAGE ── */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [show, setShow]   = useState(false);
  const [rem, setRem]     = useState(false);

  return (
    <div className="login-page">
      {/* Teal hero with illustration */}
      <div className="login-hero">
        <div className="hero-illustration">
          <svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
            {/* Background glow */}
            <ellipse cx="130" cy="200" rx="90" ry="18" fill="rgba(0,0,0,0.1)"/>
            {/* Main document card */}
            <rect x="50" y="50" width="130" height="160" rx="14" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <rect x="65" y="72" width="50" height="6" rx="3" fill="rgba(255,255,255,0.6)"/>
            <rect x="65" y="85" width="80" height="6" rx="3" fill="rgba(255,255,255,0.4)"/>
            <rect x="65" y="98" width="65" height="6" rx="3" fill="rgba(255,255,255,0.3)"/>
            {/* Chart bar area */}
            <rect x="65" y="116" width="100" height="54" rx="8" fill="rgba(255,255,255,0.12)"/>
            <rect x="76" y="148" width="14" height="16" rx="3" fill="rgba(127,255,212,0.7)"/>
            <rect x="96" y="136" width="14" height="28" rx="3" fill="rgba(127,255,212,0.85)"/>
            <rect x="116" y="143" width="14" height="21" rx="3" fill="rgba(127,255,212,0.65)"/>
            <rect x="136" y="130" width="14" height="34" rx="3" fill="#7FFFD4"/>
            {/* Checkboxes */}
            <rect x="65" y="182" width="14" height="14" rx="4" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <polyline points="68,189 71,192 76,186" stroke="#7FFFD4" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="85" y="185" width="50" height="5" rx="2.5" fill="rgba(255,255,255,0.4)"/>
            <rect x="65" y="200" width="14" height="14" rx="4" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
            <rect x="85" y="203" width="40" height="5" rx="2.5" fill="rgba(255,255,255,0.25)"/>
            {/* Person left */}
            <circle cx="28" cy="115" r="12" fill="rgba(255,255,255,0.28)"/>
            <circle cx="28" cy="109" r="5" fill="rgba(255,255,255,0.6)"/>
            <path d="M18 125 Q28 118 38 125" fill="rgba(255,255,255,0.4)" stroke="none"/>
            {/* Lightbulb */}
            <circle cx="22" cy="145" r="8" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
            <path d="M22 139 v2 M17.5 141 l1.5 1.5 M26.5 141 l-1.5 1.5" stroke="rgba(255,255,212,0.7)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            {/* Person right */}
            <circle cx="232" cy="100" r="12" fill="rgba(255,255,255,0.28)"/>
            <circle cx="232" cy="94" r="5" fill="rgba(255,255,255,0.6)"/>
            <path d="M222 110 Q232 103 242 110" fill="rgba(255,255,255,0.4)"/>
            {/* Raised hands person */}
            <line x1="225" y1="106" x2="218" y2="96" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="239" y1="106" x2="246" y2="95" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Small floating card */}
            <rect x="160" y="60" width="58" height="44" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
            <rect x="168" y="72" width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.5)"/>
            <rect x="168" y="81" width="40" height="5" rx="2.5" fill="rgba(255,255,255,0.3)"/>
            <rect x="168" y="90" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/>
            {/* Ladder/steps */}
            <line x1="210" y1="175" x2="210" y2="215" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="220" y1="175" x2="220" y2="215" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"/>
            {[182,192,202,212].map(y => <line key={y} x1="210" y1={y} x2="220" y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"/>)}
            {/* Decorative dots */}
            <circle cx="46" cy="65" r="4" fill="rgba(255,255,212,0.4)"/>
            <circle cx="214" cy="48" r="3" fill="rgba(127,255,212,0.5)"/>
            <circle cx="240" cy="155" r="5" fill="rgba(255,255,255,0.2)"/>
          </svg>
        </div>
      </div>

      {/* White card */}
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon"><CloudIcon/></div>
          <span className="login-brand-name">Cloud<span>Vault</span></span>
        </div>

        <h2 className="login-headline">Let's Get You Set Up<br/>for Success</h2>
        <p className="login-sub">Organize your files and manage storage easily — all in one simple, powerful app.</p>

        {/* Email */}
        <div className="cv-field">
          <div className="cv-input-wrap">
            <svg className="field-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <input className="cv-input" type="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>

        {/* Password */}
        <div className="cv-field">
          <div className="cv-input-wrap">
            <svg className="field-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <input className="cv-input" type={show ? "text" : "password"} placeholder="Enter your password" value={pass} onChange={e => setPass(e.target.value)}/>
            <svg className="cv-eye" viewBox="0 0 24 24" onClick={() => setShow(!show)} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="#b0b5be" strokeWidth="1.8">
              {show
                ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              }
            </svg>
          </div>
        </div>

        <div className="cv-row">
          <label className="cv-remember">
            <input type="checkbox" checked={rem} onChange={e => setRem(e.target.checked)}/>
            <span>Remember Me</span>
          </label>
          <span className="cv-forgot">Forgot Password?</span>
        </div>

        <button className="cv-btn-main" onClick={onLogin}>Get Started</button>
      </div>
    </div>
  );
}

/* ── HOME BODY ── */
function HomeBody({ showToast }) {
  const [showUpload, setShowUpload] = useState(false);

  const actions = [
    { color:"teal",    label:"Upload",    icon:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></> , fn: () => setShowUpload(true) },
    { color:"blue",    label:"Photos",    icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> , fn: () => showToast("📷 Opening Photos…") },
    { color:"violet",  label:"Videos",    icon:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></> , fn: () => showToast("🎬 Opening Videos…") },
    { color:"rose",    label:"Share",     icon:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> , fn: () => showToast("🔗 Share link copied!") },
  ];

  return (
    <>
      <div className="home-body">
        <div className="sheet-pill"/>
        <div className="sec-header"><span className="sec-title">Quick Actions</span></div>
        <div className="quick-grid">
          {actions.map((a,i) => (
            <div className="qa-btn" key={i} onClick={a.fn}>
              <div className={`qa-icon ${a.color}`}><svg viewBox="0 0 24 24">{a.icon}</svg></div>
              <span className="qa-label">{a.label}</span>
            </div>
          ))}
        </div>

        <div className="sec-header" style={{marginTop:4}}>
          <span className="sec-title">Recent Files</span>
          <span className="sec-link">See All</span>
        </div>
        <div className="file-list">
          {allFiles.slice(0,4).map((f,i) => (
            <div className="file-row" key={i} onClick={() => showToast(`📂 Opening ${f.name}`)}>
              <div className={`file-thumb ft-${f.type}`}><FileThumb type={f.type}/></div>
              <div className="file-info">
                <p className="file-name">{f.name}</p>
                <p className="file-meta">{f.meta}</p>
              </div>
              <span className="file-size">{f.size}</span>
              <span className="file-dots" onClick={e => { e.stopPropagation(); showToast("⚙️ Options opened"); }}>···</span>
            </div>
          ))}
        </div>

        <div className="sec-header">
          <span className="sec-title">Media Gallery</span>
          <span className="sec-link">See All</span>
        </div>
        <div className="media-grid">
          {mediaGrid.map((m,i) => (
            <div className={`media-cell ${m.cls}`} key={i} onClick={() => showToast(m.type==="vid" ? "▶️ Playing video…" : "🖼️ Opening image…")}>
              {m.type==="img"
                ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                : <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              }
              {m.type==="vid" && <span className="vid-tag">▶ VID</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-pill"/>
            <p className="modal-title">Upload Files</p>
            <div className="upload-options">
              {[
                { label:"Camera",     sub:"Take a photo or video", color:"teal",   icon:<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></> },
                { label:"Gallery",    sub:"Choose from photos",     color:"violet", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
                { label:"Files",      sub:"Browse your storage",    color:"blue",   icon:<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></> },
                { label:"Cloud Link", sub:"Paste a cloud URL",       color:"rose",   icon:<><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></> },
              ].map((o,i) => (
                <div className="upload-opt" key={i} onClick={() => { setShowUpload(false); showToast(`⬆️ ${o.label} selected`); }}>
                  <div className={`upload-opt-icon qa-icon ${o.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{o.icon}</svg></div>
                  <span className="upload-opt-label">{o.label}</span>
                  <span className="upload-opt-sub">{o.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── FILES BODY ── */
function FilesBody({ showToast }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery]   = useState("");
  const filters = ["all","images","videos","docs"];
  const visible = allFiles.filter(f => (filter==="all" || f.cat===filter) && f.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="home-body">
      <div className="sheet-pill"/>
      <div className="sec-header"><span className="sec-title">All Files</span><span className="sec-link">{visible.length} items</span></div>
      <div className="search-wrap">
        <div className="search-bar">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search files…" value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        <div className="sort-btn" onClick={() => showToast("⬇️ Sorted by date")}><svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></svg></div>
      </div>
      <div className="filter-row">
        {filters.map(f => <span key={f} className={`filter-chip ${filter===f?"active":""}`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</span>)}
      </div>
      <div className="file-list">
        {visible.length === 0
          ? <p style={{color:"#9ca3af",textAlign:"center",padding:"28px 0",fontSize:"13px"}}>No files found</p>
          : visible.map((f,i) => (
            <div className="file-row" key={i} onClick={() => showToast(`📂 Opening ${f.name}`)}>
              <div className={`file-thumb ft-${f.type}`}><FileThumb type={f.type}/></div>
              <div className="file-info">
                <p className="file-name">{f.name}</p>
                <p className="file-meta">{f.meta} · {f.size}</p>
              </div>
              <span className="file-dots" onClick={e => { e.stopPropagation(); showToast("⚙️ Options opened"); }}>···</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ── GALLERY BODY ── */
function GalleryBody({ showToast }) {
  const all = [...mediaGrid, ...mediaGrid.map((m,i) => ({...m, cls: ["mc3","mc1","mc5","mc2","mc6","mc4"][i]}))];
  return (
    <div className="home-body">
      <div className="sheet-pill"/>
      <div className="sec-header"><span className="sec-title">Media Gallery</span><span className="sec-link">{all.length} items</span></div>
      <div className="media-grid">
        {all.map((m,i) => (
          <div className={`media-cell ${m.cls}`} key={i} onClick={() => showToast(m.type==="vid" ? "▶️ Playing video…" : "🖼️ Opening image…")}>
            {m.type==="img"
              ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              : <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            }
            {m.type==="vid" && <span className="vid-tag">▶ VID</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PROFILE BODY ── */
function ProfileBody({ showToast, onLogout }) {
  const menuItems = [
    { icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>, label:"Edit Profile",     sub:"Update your info",          color:"teal"   },
    { icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,           label:"Privacy & Security", sub:"Password, 2FA",              color:"blue"   },
    { icon: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,   label:"Notifications",      sub:"Manage alerts",              color:"violet" },
    { icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,   label:"Storage Plan",       sub:"Upgrade to 50 GB",          color:"rose"   },
    { icon: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></>, label:"Help & Support",     sub:"Get help anytime",          color:"amber"  },
  ];

  return (
    <div className="home-page profile-page">
      <div className="profile-header-area">
        <div className="profile-avatar">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <p className="profile-name">Muhajir Payao</p>
        <p className="profile-email">mjdev@cloudvault</p>
      </div>
      <div className="profile-body">
        <div className="sheet-pill"/>
        <div className="profile-stat-row">
          {[["124","Files"],["12.4 GB","Used"],["62%","Full"]].map(([v,l]) => (
            <div className="profile-stat" key={l}><p className="pstat-val">{v}</p><p className="pstat-lbl">{l}</p></div>
          ))}
        </div>
        <div className="menu-list">
          {menuItems.map((m,i) => (
            <div className="menu-row" key={i} onClick={() => showToast(`⚙️ Opening ${m.label}…`)}>
              <div className={`menu-row-icon qa-icon ${m.color}`}><svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{m.icon}</svg></div>
              <div className="menu-row-info"><p className="menu-row-title">{m.label}</p><p className="menu-row-sub">{m.sub}</p></div>
              <span className="menu-row-arrow">›</span>
            </div>
          ))}
        </div>
        <div className="logout-row"><button className="logout-btn" onClick={onLogout}>Log Out</button></div>
      </div>
    </div>
  );
}

/* ── HOME PAGE ── */
function HomePage({ onLogout }) {
  const [nav, setNav]     = useState("home");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const navItems = [
    { id:"home",    label:"Home",    icon:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { id:"files",   label:"Files",   icon:<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></> },
  ];
  const navItemsRight = [
    { id:"gallery", label:"Gallery", icon:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
    { id:"profile", label:"Profile", icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  ];

  return (
    <div className="home-page">
      {/* Header — only show on non-profile pages */}
      {nav !== "profile" && (
        <div className="home-header">
          <div className="home-header-row">
            <div className="home-brand">
              <div className="home-brand-icon"><CloudIcon/></div>
              <span className="home-brand-name">Cloud<span>Vault</span></span>
            </div>
            <div className="home-notif" onClick={() => showToast("🔔 No new notifications")}>
              <BellIcon/>
              <div className="notif-dot"/>
            </div>
          </div>
          <div className="home-greeting">
            <p className="home-greeting-sub">Good afternoon 👋</p>
            <h2 className="home-greeting-name">Muhajir <span>Payao</span></h2>
            <p className="home-greeting-desc">Your files are safe & organized</p>
          </div>
          <div className="storage-card">
            <div className="storage-top">
              <span className="storage-lbl">Storage Used</span>
              <span className="storage-amt">12.4 GB / 20 GB</span>
            </div>
            <div className="storage-track"><div className="storage-fill"/></div>
            <div className="storage-types">
              {[["#7FFFD4","Photos 4.2 GB"],["#C4B5FD","Videos 6.8 GB"],["#FDE68A","Docs 1.4 GB"]].map(([c,l]) => (
                <div className="storage-type-item" key={l}><div className="s-dot" style={{background:c}}/><span>{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      {nav === "home"    && <HomeBody    showToast={showToast}/>}
      {nav === "files"   && <FilesBody   showToast={showToast}/>}
      {nav === "gallery" && <GalleryBody showToast={showToast}/>}
      {nav === "profile" && <ProfileBody showToast={showToast} onLogout={onLogout}/>}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Bottom Nav */}
      <div className="bottom-nav">
        {navItems.map(n => (
          <div className="nav-item" key={n.id} onClick={() => setNav(n.id)}>
            <div className={`nav-icon-wrap ${nav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${nav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}
        <div className="nav-fab" onClick={() => showToast("⬆️ Upload started")}>
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        {navItemsRight.map(n => (
          <div className="nav-item" key={n.id} onClick={() => setNav(n.id)}>
            <div className={`nav-icon-wrap ${nav===n.id?"active":""}`}><svg viewBox="0 0 24 24">{n.icon}</svg></div>
            <span className={`nav-lbl ${nav===n.id?"active":""}`}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ROOT ── */
export default function App() {
  const [page, setPage] = useState("login");
  return (
    <>
      <style>{styles}</style>
      <div className="cv-app">
        {page === "login"
          ? <LoginPage onLogin={() => setPage("home")}/>
          : <HomePage  onLogout={() => setPage("login")}/>
        }
      </div>
    </>
  );
}
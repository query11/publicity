/* plus小店 付款后充值流程 — deterministic timeline.
 * window.seek(t) renders the frame at time t (seconds). window.STAGE_READY resolves once fonts/images are ready.
 * Open index.html?play in a browser to preview in real time, or index.html?t=20 to inspect one frame.
 * No monetary amount and no "GPT" wording appear anywhere (the captures are sanitised, see tools/capture_recharge.js).
 */
(() => {
  const FPS = 30;
  const DURATION = 49;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    io: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const seg = (t, a, b, e = 'io') => E[e](clamp((t - a) / (b - a)));
  const vis = (t, a, b, d = 0.35) => clamp(Math.min((t - a) / d, (b - t) / d));
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const p = E[e || 'io'](clamp((t - t0) / (t1 - t0 || 1e-6)));
        return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : lerp(v0, v1, p);
      }
    }
    return keys[keys.length - 1][1];
  }
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const op = (el, v) => { el.style.opacity = v.toFixed(4); el.style.visibility = v <= 0.001 ? 'hidden' : 'visible'; };

  /* ---------------- browser recording ---------------- */
  const SX = 240, SY = 140;                 // page (site CSS px) -> world
  const P = (x, y) => [SX + x, SY + y];
  const NEUTRAL = [960, 570, 1];
  const CAM = [
    // self-service recharge site
    [12.0, NEUTRAL], [13.2, NEUTRAL],
    [13.9, [...P(487, 300), 1.6]], [15.9, [...P(487, 300), 1.6]],
    [16.7, [...P(1090, 400), 1.5]], [18.6, [...P(1090, 400), 1.5]],
    [19.4, [...P(487, 470), 1.5]], [21.6, [...P(487, 470), 1.5]],
    [22.3, [...P(800, 560), 1.2]], [23.0, [...P(800, 560), 1.2]],
    [23.5, [...P(720, 450), 1.35]], [24.8, [...P(720, 450), 1.35]],
    [25.5, [...P(1088, 700), 1.5]], [32.15, [...P(1088, 700), 1.5]],
    // 16688 order query
    [32.16, NEUTRAL, 'lin'], [33.6, NEUTRAL],
    [34.4, [...P(720, 343), 1.45]], [42.0, [...P(720, 343), 1.45]],
  ];
  // screen timeline: [start, image id, crossfade]; the latest started entry is shown on top of the previous one
  const SCREENS = [
    [0, 'rc00', 0], [14.1, 'rc01', 0.06], [14.45, 'rc02', 0.06], [15.2, 'rc03', 0.15], [17.6, 'rc04', 0.1],
    [18.8, 'rc03', 0.1], [19.6, 'rc05', 0.06], [19.95, 'rc06', 0.06], [20.8, 'rc07', 0.15], [22.5, 'rc08', 0.1],
    [23.1, 'rc09', 0.25], [24.1, 'rc10', 0.1], [24.85, 'rc11', 0.25], [26.6, 'rc12', 0.2], [28.6, 'rc13', 0.25],
    [32.15, 'sh_oq', 0], [34.5, 'sh_oqf', 0.06],
  ];
  const URLS = [[0, 'chong.cccard.uk'], [32.15, 'www.16688.com.cn/order']];
  const OQ_T0 = 34.75, OQ_DT = 0.1, OQ_N = 16, OQ_HOVER = 36.9;
  const WCUR = [
    [13.2, [1000, 830]], [14.0, [330, 291]], [14.6, [400, 335]], [16.8, [400, 335]], [17.6, [965, 444]], [18.5, [965, 444]],
    [19.55, [330, 430]], [20.1, [440, 470]], [21.8, [440, 470]], [22.5, [779, 731]], [23.2, [779, 731]], [24.05, [842, 629]],
    [24.7, [842, 629]], [25.4, [990, 760]], [26.6, [990, 760]],
    [31.6, [1150, 640]], [33.4, [1150, 640]], [34.4, [640, 343]], [34.8, [700, 398]], [36.3, [700, 398]], [36.9, [1073, 343]], [42, [1073, 343]],
  ];
  const WCLICKS = [14.1, 19.6, 22.9, 24.6, 34.45];
  const WCUR_VIS = [[13.2, 25.8], [33.4, 40.5]];
  const WORLD_VIS = [[12.2, 32.15], [32.2, 40.5]];
  const HL = [['hlGuide', 16.7, 18.7], ['hlDone', 28.9, 31.7], ['hlOq', 37.0, 39.9]];

  /* ---------------- HUD ---------------- */
  const STEPS = [
    [4.6, 12.4, 'STEP 1', '复制卡密', 0],
    [12.4, 22.3, 'STEP 2', '填写卡密和账号凭证', 1],
    [22.3, 32.2, 'STEP 3', '提交充值', 2],
    [32.2, 40.0, '小贴士', '订单查询 · 找回卡密', 3],
  ];
  const HUD_VIS = [4.6, 40.0];
  const CAPS = [
    [5.0, 8.0, '付款后自动发货，订单页<b>直接复制卡密</b>'],
    [8.2, 12.0, '按使用说明，打开<b>自助充值站</b>'],
    [12.8, 15.9, '粘贴<b>会员卡密 (CDK)</b>，自动识别套餐'],
    [16.1, 19.1, '按右侧指南：登录账号，打开 session，<b>复制完整凭证</b>'],
    [19.3, 22.1, '粘贴<b>账号凭证 (Session)</b>，自动校验账号'],
    [22.3, 24.7, '核对账号和套餐，点击「<b>开始充值</b>」并确认提交'],
    [24.9, 28.4, '任务自动排队处理，<b>预计 3 分钟内完成</b>'],
    [28.7, 31.8, '充值成功！重新登录账号即可看到 <b>Plus 会员</b>'],
    [33.5, 39.8, '卡密忘了保存？在 16688「<b>订单查询</b>」输入下单邮箱即可找回'],
  ];
  const WIPES = [4.3, 12.0, 31.9, 39.65];
  const TAGS = [[4.8, 12.3, '示意画面'], [12.6, 31.9, '演示数据']];
  const SPEED_VIS = [25.0, 31.4];
  const SUCCESS_T = 28.65;
  const MUSIC = { introEnd: 4.3, buildStart: 26.0, drop: SUCCESS_T, endStart: 45.6 };

  /* ---------------- illustrated scenes ---------------- */
  const SCENES = { 's-hook': [-1, 4.55], 's-order': [4.5, 12.6], 's-outro': [39.9, 99] };
  const KEY = 'PLUS-7XK2-M9QF-4TBA';
  const KEY_T0 = 5.6;
  const ORDER_CLICK = 8.1;
  const OUT0 = 40.2; // outro start

  /* ---------------- sound effects (exported for the audio mixer) ---------------- */
  const SFX = [];
  WIPES.forEach(t => SFX.push({ t: t + 0.05, type: 'whoosh' }));
  SFX.push({ t: 0.2, type: 'impact', gain: 0.8 });
  [1.3, 1.65, 2.0].forEach(t => SFX.push({ t, type: 'pop' }));
  SFX.push({ t: ORDER_CLICK, type: 'click' });
  SFX.push({ t: ORDER_CLICK + 0.1, type: 'pop', gain: 0.6 });
  SFX.push({ t: 9.2, type: 'notify' });
  WCLICKS.forEach(t => SFX.push({ t, type: 'click' }));
  [14.45, 19.95].forEach(t => SFX.push({ t, type: 'paste' }));
  [15.2, 20.8].forEach(t => SFX.push({ t, type: 'pop' }));
  [24.85, 26.6].forEach(t => SFX.push({ t, type: 'tick' }));
  SFX.push({ t: SUCCESS_T, type: 'success' });
  for (let i = 0; i < OQ_N; i++) SFX.push({ t: OQ_T0 + i * OQ_DT, type: 'key', seed: 40 + i });
  [0, 1, 2].forEach(i => SFX.push({ t: OUT0 + 0.9 + i * 0.3, type: 'pop', gain: 0.7 }));
  SFX.sort((a, b) => a.t - b.t);

  /* ---------------- init ---------------- */
  const el = {};
  document.querySelectorAll('[id]').forEach(n => { el[n.id] = n; });
  for (let i = 1; i <= OQ_N; i++) { const im = new Image(); im.src = `../assets/oq/q${String(i).padStart(2, '0')}.png`; el.oqWin.appendChild(im); }
  { const im = new Image(); im.src = '../assets/oq/q_hover.png'; el.oqWin.appendChild(im); }
  el.qrShopHolder.innerHTML = window.QR.shop;
  const SHOT_IDS = [...new Set(SCREENS.map(s => s[1]))];
  // confetti (HUD layer), bursting from the success card
  const confetti = [];
  {
    const r = rng(7);
    const colors = ['#ff5000', '#ff9a3d', '#16b364', '#4c7dff', '#ffd23f', '#ff4d8d'];
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.background = colors[i % colors.length];
      el.confettiBox.appendChild(d);
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.6;
      const sp = 700 + r() * 900;
      confetti.push({ d, x0: 1300 + (r() - 0.5) * 200, y0: 430, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: r() * 360, vr: (r() - 0.5) * 900, s: 0.7 + r() * 0.6, delay: r() * 0.15 });
    }
  }
  const center = n => { const a = n.getBoundingClientRect(); return [a.left + a.width / 2, a.top + a.height / 2]; };
  const G = { copy: center(el.copyBtn) };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const UCUR = [[6.9, [1560, 1000]], [7.9, G.copy], [8.7, add(G.copy, [60, 70])], [12.6, add(G.copy, [60, 70])]];
  const UCLICKS = [ORDER_CLICK];
  const UCUR_VIS = [[6.9, 12.55]];
  // preload all caption glyphs
  const glyphs = document.createElement('div');
  glyphs.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;font-weight:700';
  glyphs.innerHTML = CAPS.map(c => c[2]).join(' ') + STEPS.map(s => s[2] + s[3]).join(' ') + TAGS.map(s => s[2]).join(' ') + '0123456789:+-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  document.body.appendChild(glyphs);

  const ready = (async () => {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map(i => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise(res => { i.onload = () => i.decode().then(res, res); i.onerror = res; }))));
    const text = document.body.innerText + glyphs.innerText;
    const loads = [];
    for (const w of [400, 500, 700, 900]) loads.push(document.fonts.load(`${w} 40px "Noto Sans SC"`, text));
    loads.push(document.fonts.load(`400 100px "ZCOOL QingKe HuangYou"`, text));
    await Promise.all(loads);
    await document.fonts.ready;
    return true;
  })();

  /* ---------------- render ---------------- */
  let lastCap = -1, lastStep = -1, lastUrl = '', lastTag = '';
  const cursorAt = (keys, t) => track(t, keys);
  function inWins(t, wins, d = 0.2) { let v = 0; for (const [a, b] of wins) v = Math.max(v, vis(t, a, b, d)); return v; }
  function clickPulse(t, clicks) { let s = 1, rip = null; for (const c of clicks) { const dt = t - c; if (dt >= -0.08 && dt < 0.14) s = Math.min(s, 0.82); if (dt >= 0 && dt < 0.5) rip = { c, p: dt / 0.5 }; } return { s, rip }; }
  const popIn = (n, t, a, from = 0.6) => { op(n, clamp((t - a) / 0.15)); n.style.transform = `scale(${from + (1 - from) * seg(t, a, a + 0.4, 'back')})`; };

  function seek(t) {
    /* background */
    css(el.glow1, { transform: `translate(${-200 + 260 * Math.sin(t * 0.17)}px, ${-260 + 160 * Math.cos(t * 0.13)}px)` });
    css(el.glow2, { transform: `translate(${1150 + 220 * Math.cos(t * 0.11)}px, ${380 + 180 * Math.sin(t * 0.15)}px)` });

    /* world (real browser pages) */
    const wv = inWins(t, WORLD_VIS, 0.45);
    op(el.world, wv);
    if (wv > 0) {
      let enter = 1;
      for (const [a, b] of WORLD_VIS) if (t >= a - 0.5 && t < b) enter = seg(t, a, a + 0.9, 'out');
      css(el.browser, { transform: `translateY(${(1 - enter) * 70}px) scale(${0.94 + 0.06 * enter})` });
      // camera (clamped so the view stays on the browser frame)
      let [fx, fy, z] = track(t, CAM);
      const hw = 960 / z, hh = 540 / z;
      fx = 1440 < 2 * hw ? 960 : clamp(fx, 240 + hw, 1680 - hw);
      // vertical: allow the view to run up to 170px past the frame bottom so low UI clears the caption bar
      fy = 940 < 2 * hh ? 570 : clamp(fy, 100 + hh, 1040 - hh + 170);
      css(el.world, { transform: `translate(${960 - fx * z}px, ${540 - fy * z}px) scale(${z})` });
      // screens
      let ci = 0;
      for (let i = 0; i < SCREENS.length; i++) if (t >= SCREENS[i][0]) ci = i;
      const [cs, cid, cf] = SCREENS[ci];
      const pid = ci > 0 ? SCREENS[ci - 1][1] : null;
      for (const id of SHOT_IDS) {
        const n = el[id];
        if (id === cid) { op(n, cf ? clamp((t - cs) / cf) : 1); n.style.zIndex = 2; }
        else if (id === pid) { op(n, 1); n.style.zIndex = 1; }
        else { op(n, 0); n.style.zIndex = 0; }
      }
      let url = URLS[0][1];
      for (const [a, u] of URLS) if (t >= a) url = u;
      if (url !== lastUrl) { el.urlText.textContent = url; lastUrl = url; }
      // typing overlay (order query)
      const qOn = t >= OQ_T0;
      op(el.oqWin, qOn ? 1 : 0);
      el.oqWin.style.zIndex = 3;
      if (qOn) { const k = t >= OQ_HOVER ? OQ_N : clamp(Math.floor((t - OQ_T0) / OQ_DT), 0, OQ_N - 1); Array.from(el.oqWin.children).forEach((im, i) => { im.style.opacity = i === k ? 1 : 0; }); }
      // highlight boxes
      for (const [id, a, b] of HL) { const n = el[id]; op(n, vis(t, a, b, 0.25)); n.style.zIndex = 4; n.style.transform = `scale(${1 + 0.06 * (1 - seg(t, a, a + 0.35, 'out'))})`; }
      // cursor + ripple
      const cv = inWins(t, WCUR_VIS, 0.2);
      op(el.wCursor, cv);
      el.wCursor.style.zIndex = 6; el.wRipple.style.zIndex = 5;
      const [cx, cy] = cursorAt(WCUR, t);
      const cp = clickPulse(t, WCLICKS);
      el.wCursor.style.transform = `translate(${cx - 3}px, ${cy - 3}px) scale(${cp.s})`;
      if (cp.rip && cv > 0) {
        const [rx, ry] = cursorAt(WCUR, cp.rip.c);
        css(el.wRipple, { left: rx + 'px', top: ry + 'px', transform: `scale(${0.3 + 1.4 * E.out(cp.rip.p)})` });
        op(el.wRipple, 0.95 * (1 - cp.rip.p));
      } else op(el.wRipple, 0);
    }

    /* illustrated scenes */
    for (const id in SCENES) { const [a, b] = SCENES[id]; op(el[id], vis(t, a, b, 0.35)); }

    // hook
    if (t < 4.7) {
      const a = seg(t, 0.15, 0.8, 'out'), b = seg(t, 0.6, 1.2, 'out');
      op(el.hookTitle, a); el.hookTitle.style.transform = `translateY(${(1 - a) * 50}px) scale(${0.96 + 0.04 * a})`;
      op(el.hookSub, b); el.hookSub.style.transform = `translateY(${(1 - b) * 30}px)`;
      [0, 1, 2].forEach(i => popIn(el['hs' + i], t, 1.3 + i * 0.35));
      [0, 1].forEach(i => op(el['ha' + i], clamp((t - 1.5 - i * 0.35) / 0.2)));
    }
    // STEP 1: order delivered
    if (t > 4.2 && t < 12.9) {
      const cin = seg(t, 4.7, 5.3, 'out');
      el.orderCard.style.transform = `translateY(${(1 - cin) * 60}px) scale(${0.96 + 0.04 * cin})`;
      let code = '';
      if (t < KEY_T0) code = '••••-••••-••••-••••';
      else {
        const r = rng(Math.floor(t * FPS) + 3);
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let i = 0; i < KEY.length; i++) code += KEY[i] === '-' ? '-' : (t >= KEY_T0 + 0.25 + i * 0.045 ? KEY[i] : chars[Math.floor(r() * chars.length)]);
      }
      el.keyCode.textContent = code;
      const copied = t >= ORDER_CLICK + 0.05;
      el.copyTxt.textContent = copied ? '已复制' : '复制';
      el.copyBtn.style.background = copied ? '#16b364' : '';
      el.copyBtn.style.transform = `scale(${t >= ORDER_CLICK - 0.05 && t < ORDER_CLICK + 0.1 ? 0.95 : 1})`;
      op(el.copyToast, vis(t, ORDER_CLICK + 0.15, ORDER_CLICK + 1.8, 0.2));
      el.copyToast.style.transform = `translateX(-50%) translateY(${(1 - seg(t, ORDER_CLICK + 0.15, ORDER_CLICK + 0.45, 'out')) * -20}px)`;
      const mt = seg(t, 9.2, 9.7, 'out');
      op(el.mailToast, clamp((t - 9.2) / 0.2));
      el.mailToast.style.transform = `translateX(${(1 - mt) * 640}px)`;
    }
    // outro
    if (t > OUT0 - 0.6) {
      const a = seg(t, OUT0, OUT0 + 0.6, 'out'), b = seg(t, OUT0 + 0.3, OUT0 + 0.9, 'out');
      op(el.outTitle, a); el.outTitle.style.transform = `translateY(${(1 - a) * 40}px)`;
      op(el.outSub, b); el.outSub.style.transform = `translateY(${(1 - b) * 40}px)`;
      [0, 1, 2].forEach(i => popIn(el['os' + i], t, OUT0 + 0.9 + i * 0.3, 0.7));
      [0, 1].forEach(i => op(el['oa' + i], clamp((t - OUT0 - 1.05 - i * 0.3) / 0.2)));
      Array.from(el.outChips.children).forEach((c, i) => { const s = OUT0 + 1.9 + i * 0.15; op(c, clamp((t - s) / 0.2)); c.style.transform = `translateY(${(1 - seg(t, s, s + 0.3, 'out')) * 20}px)`; });
      const q = seg(t, OUT0 + 0.6, OUT0 + 1.3, 'out');
      op(el.qrCard, q); el.qrCard.style.transform = `translateX(${(1 - q) * 90}px)`;
      op(el.disclaimer, clamp((t - OUT0 - 2.4) / 0.5));
    }

    /* confetti on recharge success */
    for (const c of confetti) {
      const tau = t - SUCCESS_T - 0.05 - c.delay;
      if (tau <= 0 || tau > 3) { op(c.d, 0); continue; }
      const x = c.x0 + c.vx * tau * 0.6, y = c.y0 + c.vy * tau + 0.5 * 1500 * tau * tau;
      op(c.d, clamp(1 - (tau - 1.8) / 0.8));
      c.d.style.transform = `translate(${x}px, ${y}px) rotate(${c.rot + c.vr * tau}deg) scale(${c.s})`;
    }

    /* illustration cursor */
    const ucv = inWins(t, UCUR_VIS, 0.2);
    op(el.uCursor, ucv);
    if (ucv > 0) {
      const [ux, uy] = cursorAt(UCUR, t);
      const up = clickPulse(t, UCLICKS);
      el.uCursor.style.transform = `translate(${ux - 4}px, ${uy - 4}px) scale(${up.s})`;
      if (up.rip) { const [rx, ry] = cursorAt(UCUR, up.rip.c); css(el.uRipple, { left: rx + 'px', top: ry + 'px', transform: `scale(${0.3 + 1.3 * E.out(up.rip.p)})` }); op(el.uRipple, 0.95 * (1 - up.rip.p)); } else op(el.uRipple, 0);
    } else op(el.uRipple, 0);

    /* HUD: step + progress */
    let si = -1;
    for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0] && t < STEPS[i][1]) si = i;
    const hv = vis(t, HUD_VIS[0], HUD_VIS[1], 0.35);
    op(el.step, hv); op(el.prog, hv);
    if (si >= 0 && si !== lastStep) {
      el.stepK.textContent = STEPS[si][2]; el.stepL.textContent = STEPS[si][3];
      const cur = STEPS[si][4];
      [0, 1, 2].forEach(i => { el['pn_' + i].className = 'pn' + (i < cur ? ' done' : i === cur ? ' on' : ''); el['pn_' + i].firstElementChild.textContent = i < cur ? '✓' : String(i + 1); });
      lastStep = si;
    }
    if (si >= 0) { const k = seg(t, STEPS[si][0], STEPS[si][0] + 0.3, 'out'); el.step.style.transform = `translateX(${(1 - k) * -24}px)`; }
    let tv = 0;
    for (const [a, b, txt] of TAGS) { const v = vis(t, a, b, 0.3); if (v > 0) { tv = v; if (txt !== lastTag) { el.demoTag.textContent = txt; lastTag = txt; } } }
    op(el.demoTag, tv);
    op(el.speedTag, vis(t, SPEED_VIS[0], SPEED_VIS[1], 0.3));

    /* captions */
    let k2 = -1;
    for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][0] && t < CAPS[i][1]) k2 = i;
    if (k2 !== lastCap) { if (k2 >= 0) el.cap.innerHTML = CAPS[k2][2]; lastCap = k2; }
    if (k2 >= 0) {
      const [a, b] = CAPS[k2];
      op(el.cap, vis(t, a, b, 0.22));
      el.cap.style.transform = `translateX(-50%) translateY(${(1 - seg(t, a, a + 0.3, 'out')) * 18}px)`;
    } else op(el.cap, 0);

    /* transitions */
    let wp = -1;
    for (const w of WIPES) if (t >= w && t < w + 0.6) wp = (t - w) / 0.6;
    if (wp >= 0) { op(el.wipe, 0.85); el.wipe.style.left = `${lerp(-1300, 2300, E.io(wp))}px`; } else op(el.wipe, 0);
    op(el.fade, Math.max(seg(t, DURATION - 0.9, DURATION, 'lin'), 1 - clamp(t / 0.25)));
  }

  window.FPS = FPS;
  window.DURATION = DURATION;
  window.SFX = SFX;
  window.MUSIC = MUSIC;
  window.CAPTIONS = CAPS.map(([a, b, h]) => ({ start: a, end: b, text: h.replace(/<[^>]+>/g, '') }));
  window.seek = seek;
  window.STAGE_READY = ready;

  seek(0);
  if (/play/.test(location.search)) {
    const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); document.body.style.transform = `scale(${s})`; document.body.style.transformOrigin = '0 0'; };
    fit(); addEventListener('resize', fit);
    ready.then(() => { const t0 = performance.now(); const loop = () => { seek(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); });
  }
  const m = location.search.match(/t=([\d.]+)/);
  if (m) ready.then(() => seek(parseFloat(m[1])));
})();

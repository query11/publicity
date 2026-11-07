/* plus小店 充值流程演示 — deterministic timeline.
 * window.seek(t) renders the frame at time t (seconds). window.STAGE_READY resolves once fonts/images are ready.
 * Open index.html?play in a browser to preview in real time, or index.html?t=12.5 to inspect one frame.
 * No monetary amount appears anywhere: the real screenshots are captured with prices blurred.
 */
(() => {
  const FPS = 30;
  const DURATION = 93;
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
    // 16688 shop
    [11.0, NEUTRAL], [13.2, NEUTRAL],
    [14.6, [...P(330, 190), 1.55]], [16.0, [...P(330, 190), 1.55]],
    [17.2, [...P(830, 470), 1.4]], [19.9, [...P(830, 470), 1.4]],
    [20.8, [...P(720, 450), 1.0]], [22.2, [...P(720, 450), 1.0]],
    [23.2, [...P(720, 362), 1.7]], [29.6, [...P(720, 362), 1.7]],
    [30.6, [...P(720, 600), 1.7]], [33.8, [...P(720, 600), 1.7]],
    [34.5, [...P(720, 740), 1.6]], [37.0, [...P(720, 740), 1.6]],
    [37.7, [...P(860, 790), 1.75]], [38.6, [...P(860, 790), 1.75]],
    [40.3, [...P(946, 818), 2.6], 'in'],
    // self-service recharge site
    [40.31, NEUTRAL, 'lin'], [57.6, NEUTRAL],
    [58.3, [...P(487, 300), 1.6]], [60.3, [...P(487, 300), 1.6]],
    [61.1, [...P(1090, 400), 1.5]], [63.0, [...P(1090, 400), 1.5]],
    [63.8, [...P(487, 470), 1.5]], [66.0, [...P(487, 470), 1.5]],
    [66.7, [...P(800, 560), 1.2]], [67.4, [...P(800, 560), 1.2]],
    [67.9, [...P(720, 450), 1.35]], [69.2, [...P(720, 450), 1.35]],
    [69.9, [...P(1088, 700), 1.5]], [76.55, [...P(1088, 700), 1.5]],
    // 16688 order query
    [76.56, NEUTRAL, 'lin'], [78.0, NEUTRAL],
    [78.8, [...P(720, 343), 1.45]], [86.0, [...P(720, 343), 1.45]],
  ];
  // screen timeline: [start, image id, crossfade]; the latest started entry is shown on top of the previous one
  const SCREENS = [
    [0, 'sh_shop', 0], [17.1, 'sh_hover', 0.12], [20.0, 'sh_modal', 0.28], [31.0, 'sh_focus', 0.06],
    [34.75, 'sh_filled', 0.06], [37.6, 'sh_confirm', 0.1],
    [50.0, 'rc00', 0], [58.5, 'rc01', 0.06], [58.85, 'rc02', 0.06], [59.6, 'rc03', 0.15], [62.0, 'rc04', 0.1],
    [63.2, 'rc03', 0.1], [64.0, 'rc05', 0.06], [64.35, 'rc06', 0.06], [65.2, 'rc07', 0.15], [66.9, 'rc08', 0.1],
    [67.5, 'rc09', 0.25], [68.5, 'rc10', 0.1], [69.25, 'rc11', 0.25], [71.0, 'rc12', 0.2], [73.0, 'rc13', 0.25],
    [76.55, 'sh_oq', 0], [78.9, 'sh_oqf', 0.06],
  ];
  const URLS = [[0, 'www.16688.com.cn/shop/S382939'], [50, 'chong.cccard.uk'], [76.55, 'www.16688.com.cn/order']];
  const DESC_SCROLL = [[23.5, 0], [25.0, 205], [26.7, 205], [28.7, 1625]];
  const TYPE_T0 = 31.35, TYPE_DT = 0.12, TYPE_N = 16;
  const OQ_T0 = 79.15, OQ_DT = 0.1, OQ_HOVER = 81.3;
  const WCUR = [
    [14.6, [1250, 880]], [17.0, [545, 440]], [19.6, [548, 446]], [20.6, [640, 420]], [23.0, [760, 400]], [29.0, [760, 400]],
    [30.8, [840, 612]], [31.5, [905, 652]], [33.6, [905, 652]], [34.6, [528, 742]], [35.6, [560, 772]], [37.4, [946, 819]], [41, [946, 819]],
    [57.6, [1000, 830]], [58.4, [330, 291]], [59.0, [400, 335]], [61.2, [400, 335]], [62.0, [965, 444]], [62.9, [965, 444]],
    [63.95, [330, 430]], [64.5, [440, 470]], [66.2, [440, 470]], [66.9, [779, 731]], [67.6, [779, 731]], [68.45, [842, 629]],
    [69.1, [842, 629]], [69.8, [990, 760]], [71, [990, 760]],
    [76.0, [1150, 640]], [77.8, [1150, 640]], [78.8, [640, 343]], [79.2, [700, 398]], [80.7, [700, 398]], [81.3, [1073, 343]], [86, [1073, 343]],
  ];
  const WCLICKS = [19.8, 31.0, 34.75, 38.4, 58.5, 64.0, 67.3, 69.0, 78.85];
  const WCUR_VIS = [[14.6, 40.2], [57.6, 70.2], [77.8, 84.9]];
  const WORLD_VIS = [[11.6, 40.3], [56.6, 76.55], [76.6, 84.9]];
  const HL = [['hlCard', 17.4, 19.7], ['hlPay', 35.0, 36.9], ['hlGuide', 61.1, 63.1], ['hlDone', 73.3, 76.1], ['hlOq', 81.4, 84.3]];

  /* ---------------- HUD ---------------- */
  const STEPS = [
    [12.2, 22.4, 'STEP 1', '店铺下单 · 选择商品', 0],
    [22.4, 40.0, 'STEP 1', '店铺下单 · 填写信息', 0],
    [40.0, 49.0, 'STEP 1', '店铺下单 · 扫码付款', 0],
    [49.0, 57.0, 'STEP 2', '秒收卡密', 1],
    [57.0, 76.6, 'STEP 3', '卡密充值', 2],
    [76.6, 84.6, '小贴士', '订单查询 · 找回卡密', 3],
  ];
  const CAPS = [
    [6.6, 11.4, '今天用 <b>plus小店</b>，完整演示一遍充值流程'],
    [12.9, 16.4, '打开 16688，进入 <b>plus小店</b> 店铺首页'],
    [16.6, 21.8, '选择「<b>官网正价直充 GPT Plus 30天</b>」'],
    [22.6, 26.0, '详情写明：<b>官方直充</b>、一卡一充、可开国内发票'],
    [26.2, 29.9, '下单前看一眼质保：充值成功后<b>质保 30 天</b>'],
    [30.2, 34.0, '填写联系邮箱，<b>方便之后查单、找回卡密</b>'],
    [34.3, 37.0, '选择<b>支付宝或微信</b>支付，核对订单信息'],
    [37.2, 39.8, '点击「<b>确认订单</b>」去付款'],
    [40.8, 44.8, '手机扫码付款，<b>平台担保交易</b>'],
    [45.2, 48.8, '付款成功，<b>系统自动发货</b>，不用等客服'],
    [49.6, 53.0, '订单页<b>秒发卡密</b>，一键复制'],
    [53.3, 56.6, '按使用说明，打开<b>自助充值站</b>'],
    [57.4, 60.3, '粘贴<b>会员卡密 (CDK)</b>，自动识别套餐'],
    [60.5, 63.5, '按右侧指南：登录 ChatGPT，打开 session，<b>复制完整凭证</b>'],
    [63.7, 66.5, '粘贴<b>账号凭证 (Session)</b>，自动校验账号'],
    [66.7, 69.1, '核对账号和套餐，点击「<b>开始充值</b>」并确认提交'],
    [69.3, 72.8, '任务自动排队处理，<b>预计 3 分钟内完成</b>'],
    [73.1, 76.3, '充值成功！登录 ChatGPT 即可查看 <b>Plus 会员</b>'],
    [77.9, 84.3, '卡密忘了保存？「<b>订单查询</b>」输入下单邮箱即可找回'],
  ];
  const WIPES = [5.7, 11.45, 39.75, 56.35, 76.3, 84.25];
  const TAGS = [[40.3, 56.8, '示意画面'], [57.0, 76.4, '演示数据']];
  const SUCCESS_T = 73.05;

  /* ---------------- illustrated scenes ---------------- */
  const SCENES = { 's-hook': [-1, 6.05], 's-intro': [5.85, 12.0], 's-pay': [39.9, 49.2], 's-order': [48.9, 57.0], 's-outro': [84.4, 99] };
  const KEY = 'PLUS-7XK2-M9QF-4TBA';
  const KEY_T0 = 50.0;
  const ORDER_CLICK = 52.55;

  /* ---------------- sound effects (exported for the audio mixer) ---------------- */
  const SFX = [];
  WIPES.forEach(t => SFX.push({ t: t + 0.05, type: 'whoosh' }));
  [1.2, 1.65, 2.1].forEach(t => SFX.push({ t, type: 'pop' }));
  SFX.push({ t: 3.6, type: 'impact' });
  for (let i = 0; i < 6; i++) SFX.push({ t: 7.0 + i * 0.28, type: 'pop', gain: 0.55 });
  WCLICKS.forEach(t => SFX.push({ t, type: 'click' }));
  for (let i = 0; i < TYPE_N; i++) SFX.push({ t: TYPE_T0 + i * TYPE_DT, type: 'key', seed: i });
  for (let i = 0; i < TYPE_N; i++) SFX.push({ t: OQ_T0 + i * OQ_DT, type: 'key', seed: 40 + i });
  for (let t = 23.55; t < 25.0; t += 0.11) SFX.push({ t, type: 'wheel' });
  for (let t = 26.75; t < 28.7; t += 0.09) SFX.push({ t, type: 'wheel' });
  SFX.push({ t: 43.55, type: 'beep' });
  SFX.push({ t: 44.4, type: 'click' });
  SFX.push({ t: 45.05, type: 'ding' });
  SFX.push({ t: ORDER_CLICK, type: 'click' });
  SFX.push({ t: 52.65, type: 'pop', gain: 0.6 });
  SFX.push({ t: 53.5, type: 'notify' });
  [58.85, 64.35].forEach(t => SFX.push({ t, type: 'paste' }));
  [59.6, 65.2].forEach(t => SFX.push({ t, type: 'pop' }));
  [69.25, 71.0].forEach(t => SFX.push({ t, type: 'tick' }));
  SFX.push({ t: SUCCESS_T, type: 'success' });
  [85.5, 85.8, 86.1].forEach(t => SFX.push({ t, type: 'pop', gain: 0.7 }));
  SFX.sort((a, b) => a.t - b.t);

  /* ---------------- init ---------------- */
  const el = {};
  document.querySelectorAll('[id]').forEach(n => { el[n.id] = n; });
  for (let i = 1; i <= TYPE_N; i++) { const im = new Image(); im.src = `../assets/type/t${String(i).padStart(2, '0')}.png`; el.typeWin.appendChild(im); }
  for (let i = 1; i <= TYPE_N; i++) { const im = new Image(); im.src = `../assets/oq/q${String(i).padStart(2, '0')}.png`; el.oqWin.appendChild(im); }
  { const im = new Image(); im.src = '../assets/oq/q_hover.png'; el.oqWin.appendChild(im); }
  el.qrPayHolder.innerHTML = window.QR.pay;
  el.qrMiniHolder.innerHTML = window.QR.pay;
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
  const center = (n, rel) => { const a = n.getBoundingClientRect(); const b = rel ? rel.getBoundingClientRect() : { left: 0, top: 0 }; return [a.left - b.left + a.width / 2, a.top - b.top + a.height / 2]; };
  const G = { copy: center(el.copyBtn), payBtn: center(el.payBtn, el.phoneScr) };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const UCUR = [[51.3, [1560, 1000]], [52.4, G.copy], [53.2, add(G.copy, [60, 70])], [57.0, add(G.copy, [60, 70])]];
  const UCLICKS = [ORDER_CLICK];
  const UCUR_VIS = [[51.3, 56.95]];
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

  function seek(t) {
    /* background */
    css(el.glow1, { transform: `translate(${-200 + 260 * Math.sin(t * 0.17)}px, ${-260 + 160 * Math.cos(t * 0.13)}px)` });
    css(el.glow2, { transform: `translate(${1150 + 220 * Math.cos(t * 0.11)}px, ${380 + 180 * Math.sin(t * 0.15)}px)` });

    /* world (real browser screenshots) */
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
      // description scroll overlay (order modal)
      const dOp = t >= 20.0 && t < 41 ? clamp((t - 20.0) / 0.28) : 0;
      op(el.descWin, dOp);
      el.descWin.style.zIndex = 3;
      if (dOp > 0) el.descImg.style.transform = `translateY(${-track(t, DESC_SCROLL)}px)`;
      // typing overlay (order form)
      const tOn = t >= TYPE_T0 && t < 34.75;
      op(el.typeWin, tOn ? 1 : 0);
      el.typeWin.style.zIndex = 3;
      if (tOn) { const k = clamp(Math.floor((t - TYPE_T0) / TYPE_DT), 0, TYPE_N - 1); Array.from(el.typeWin.children).forEach((im, i) => { im.style.opacity = i === k ? 1 : 0; }); }
      // typing overlay (order query)
      const qOn = t >= OQ_T0;
      op(el.oqWin, qOn ? 1 : 0);
      el.oqWin.style.zIndex = 3;
      if (qOn) { const k = t >= OQ_HOVER ? TYPE_N : clamp(Math.floor((t - OQ_T0) / OQ_DT), 0, TYPE_N - 1); Array.from(el.oqWin.children).forEach((im, i) => { im.style.opacity = i === k ? 1 : 0; }); }
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
    if (t < 6.2) {
      const tin = seg(t, 0.15, 0.8, 'out'), tout = seg(t, 3.3, 3.7, 'in');
      op(el.hookTitle, tin * (1 - tout));
      el.hookTitle.style.transform = `translateY(${(1 - tin) * 50 - tout * 30}px) scale(${0.96 + 0.04 * tin - 0.04 * tout})`;
      [0, 1, 2].forEach(i => {
        const p = seg(t, 1.2 + i * 0.45, 1.6 + i * 0.45, 'back');
        op(el['pn' + i], clamp((t - 1.2 - i * 0.45) / 0.15) * (1 - tout));
        el['pn' + i].style.transform = `translateY(${tout * 40}px) scale(${0.6 + 0.4 * p})`;
      });
      const ain = seg(t, 3.6, 4.15, 'out');
      op(el.hookAns, ain);
      el.hookAns.style.transform = `scale(${1.25 - 0.25 * ain})`;
    }
    // intro
    if (t > 5.5 && t < 12.3) {
      const cin = seg(t, 5.9, 6.6, 'out'), cout = seg(t, 11.45, 11.95, 'in');
      el.introCard.style.transform = `translateY(${(1 - cin) * 70}px) scale(${0.94 + 0.06 * cin - 0.06 * cout})`;
      Array.from(el.introBadges.children).forEach((b, i) => {
        const p = seg(t, 7.0 + i * 0.28, 7.35 + i * 0.28, 'back');
        op(b, clamp((t - 7.0 - i * 0.28) / 0.12));
        b.style.transform = `scale(${0.7 + 0.3 * p})`;
      });
      el.statN.textContent = Math.round(16000 * seg(t, 6.6, 8.0, 'out')) + '+';
    }
    // pay
    if (t > 39.5 && t < 49.5) {
      const cin = seg(t, 40.0, 40.6, 'out');
      el.payCard.style.transform = `translateY(${(1 - cin) * 60}px)`;
      const pin = seg(t, 40.9, 41.6, 'out');
      el.phone.style.transform = `translateX(${(1 - pin) * 300}px) rotate(${(1 - pin) * 6}deg)`;
      op(el.phone, clamp((t - 40.9) / 0.25));
      const secs = Math.max(0, 899 - Math.floor(Math.max(0, t - 40)));
      el.payTimer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      op(el.psScan, t >= 41.0 && t < 43.7 ? 1 : 0);
      el.scanLine.style.top = `${236 + 228 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - 41)) / 1.4))}px`;
      op(el.psPay, t >= 43.6 && t < 45.1 ? clamp((t - 43.6) / 0.15) : 0);
      el.paySheet.style.transform = `translateY(${(1 - seg(t, 43.6, 44.0, 'out')) * 520}px)`;
      const tap = t - 44.4;
      if (tap >= 0 && tap < 0.45) { css(el.tapDot, { left: G.payBtn[0] + 'px', top: G.payBtn[1] + 'px', transform: `scale(${0.5 + 0.8 * E.out(tap / 0.45)})` }); op(el.tapDot, 1 - tap / 0.45); } else op(el.tapDot, 0);
      el.payBtn.style.transform = `scale(${tap >= 0 && tap < 0.15 ? 0.96 : 1})`;
      op(el.psOk, t >= 45.0 ? clamp((t - 45.0) / 0.12) : 0);
      el.psOk.firstElementChild.style.transform = `scale(${0.4 + 0.6 * seg(t, 45.0, 45.45, 'back')})`;
      op(el.payDone, clamp((t - 45.2) / 0.25));
      el.payDone.firstElementChild.style.transform = `scale(${0.4 + 0.6 * seg(t, 45.2, 45.7, 'back')})`;
      el.paySpin.style.transform = `rotate(${t * 540}deg)`;
    }
    // order delivered
    if (t > 48.5 && t < 57.3) {
      const cin = seg(t, 49.0, 49.6, 'out');
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
      op(el.copyToast, vis(t, 52.7, 54.4, 0.2));
      el.copyToast.style.transform = `translateX(-50%) translateY(${(1 - seg(t, 52.7, 53.0, 'out')) * -20}px)`;
      const mt = seg(t, 53.5, 54.0, 'out');
      op(el.mailToast, clamp((t - 53.5) / 0.2));
      el.mailToast.style.transform = `translateX(${(1 - mt) * 640}px)`;
    }
    // outro
    if (t > 84.0) {
      const a = seg(t, 84.6, 85.2, 'out'), b = seg(t, 84.9, 85.5, 'out');
      op(el.outTitle, a); el.outTitle.style.transform = `translateY(${(1 - a) * 40}px)`;
      op(el.outSub, b); el.outSub.style.transform = `translateY(${(1 - b) * 40}px)`;
      [0, 1, 2].forEach(i => { const s = 85.5 + i * 0.3; op(el['os' + i], clamp((t - s) / 0.2)); el['os' + i].style.transform = `scale(${0.7 + 0.3 * seg(t, s, s + 0.35, 'back')})`; });
      [0, 1].forEach(i => op(el['oa' + i], clamp((t - 85.65 - i * 0.3) / 0.2)));
      Array.from(el.outChips.children).forEach((c, i) => { const s = 86.5 + i * 0.15; op(c, clamp((t - s) / 0.2)); c.style.transform = `translateY(${(1 - seg(t, s, s + 0.3, 'out')) * 20}px)`; });
      const q = seg(t, 85.2, 85.9, 'out');
      op(el.qrCard, q); el.qrCard.style.transform = `translateX(${(1 - q) * 90}px)`;
      op(el.disclaimer, clamp((t - 87.0) / 0.5));
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
    const hv = vis(t, 12.2, 84.6, 0.35);
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
    op(el.speedTag, vis(t, 69.4, 75.8, 0.3));

    /* captions */
    let ci2 = -1;
    for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][0] && t < CAPS[i][1]) ci2 = i;
    if (ci2 !== lastCap) { if (ci2 >= 0) el.cap.innerHTML = CAPS[ci2][2]; lastCap = ci2; }
    if (ci2 >= 0) {
      const [a, b] = CAPS[ci2];
      op(el.cap, vis(t, a, b, 0.22));
      el.cap.style.transform = `translateX(-50%) translateY(${(1 - seg(t, a, a + 0.3, 'out')) * 18}px)`;
    } else op(el.cap, 0);

    /* transitions */
    let wp = -1;
    for (const w of WIPES) if (t >= w && t < w + 0.6) wp = (t - w) / 0.6;
    if (wp >= 0) { op(el.wipe, 0.85); el.wipe.style.left = `${lerp(-1300, 2300, E.io(wp))}px`; } else op(el.wipe, 0);
    op(el.fade, Math.max(seg(t, 92.1, 93.0, 'lin'), 1 - clamp(t / 0.25)));
  }

  window.FPS = FPS;
  window.DURATION = DURATION;
  window.SFX = SFX;
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

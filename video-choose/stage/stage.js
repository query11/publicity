/* Plus 还是 Pro？5 种开通方式避坑 — deterministic timeline.
 * window.seek(t) renders the frame at time t (seconds). window.STAGE_READY resolves once fonts are ready.
 * Open index.html?play to preview in real time, or index.html?t=20 to inspect one frame.
 * The whole timeline is driven by the narration in stage/script.js and the voice clip durations in stage/voice.js:
 * edit a line, run tools/voice.py, and every scene re-flows.
 * Wording rules: only "Plus / Pro", no "GPT", no monetary amounts.
 */
(() => {
  const FPS = 30;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    io: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const seg = (t, a, b, e = 'io') => E[e](clamp((t - a) / (b - a)));
  const vis = (t, a, b, d = 0.35) => clamp(Math.min((t - a) / d, (b - t) / d));
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const op = (el, v) => { el.style.opacity = v.toFixed(4); el.style.visibility = v <= 0.001 ? 'hidden' : 'visible'; };
  const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  // Two endings. Default = no shop (safe to publish on Bilibili without a commercial declaration).
  // index.html?shop = ending with shop name, selling points and QR code (commercial promotion).
  const SHOP = /[?&]shop\b/.test(location.search);
  document.body.classList.add(SHOP ? 'v-shop' : 'v-clean');

  /* ---------------- narration (stage/script.js) laid out on the voice clips' real durations (stage/voice.js) ---------------- */
  const N = window.NARRATION;
  const END = SHOP ? N.endShop : N.endClean;
  const SCRIPT = [...N.main, ...END];
  const vkey = id => (SHOP && END.some(r => r[0] === id) ? 'shop_' + id : id);
  const VOICE = window.VOICE || {};
  // fallback when a clip is missing: ~5.4 characters per second (the voice runs at 1.3x)
  function speakDur(html) {
    const s = html.replace(/<[^>]+>/g, '');
    let n = 0;
    for (const ch of s) {
      if (/[\u4e00-\u9fff]/.test(ch)) n += 1;
      else if (/[A-Za-z0-9]/.test(ch)) n += 0.42;
      else if (/[，。；：、！？]/.test(ch)) n += 0.4;
      else if (ch !== ' ') n += 0.3;
    }
    return Math.max(1.6, 0.3 + n / 5.4);
  }
  const GAP = 0.2; // silence between two lines
  const T = {};
  {
    let t = 0.6;
    for (const [id, text, pause] of SCRIPT) {
      const key = vkey(id);
      const d = VOICE[key] != null ? VOICE[key] : speakDur(text);
      T[id] = { a: t, b: t + d + 0.12, key, voiced: VOICE[key] != null };
      t += d + GAP + pause;
    }
  }
  const CAPS = SCRIPT.map(([id, text]) => [T[id].a, T[id].b, text]);
  const VOICE_CUES = SCRIPT.filter(([id]) => T[id].voiced).map(([id]) => ({ key: T[id].key, t: +T[id].a.toFixed(3) }));
  const DURATION = Math.ceil((T.o3.b + 2.2) * 10) / 10;

  /* ---------------- scene windows ---------------- */
  const W = [T.p1.a - 0.55, T.m0.a - 0.55, T.c0.a - 0.55, T.o1.a - 0.55]; // orange wipes between parts
  const SW = W.map(w => w + 0.3);
  const SCENES = {
    's-hook': [-1, SW[0]],
    's-tiers': [SW[0], T.p7a.a - 0.25],
    's-flow': [T.p7a.a - 0.25, SW[1]],
    's-methods': [SW[1], T.s1.a - 0.25],
    's-table': [T.s1.a - 0.25, SW[2]],
    's-chk': [SW[2], SW[3]],
    's-outro': [SW[3], 999],
  };
  const PARTS = [
    [SW[0], SW[1], 'PART 1', '开哪一档', 0],
    [SW[1], SW[2], 'PART 2', '用什么方式开', 1],
    [SW[2], SW[3], 'PART 3', '避坑清单', 2],
  ];
  const HUD_VIS = [SW[0], SW[3]];
  const OUT0 = SW[3];
  // music cues for tools/audio.py: parts = the four orange wipes (PART 1, PART 2, PART 3, ending)
  const MUSIC = { introEnd: W[0], parts: W, endStart: DURATION - 3.5 };

  /* ---------------- content ---------------- */
  const TIERS = [
    { nm: 'Plus', sb: '入门档 · 日常够用', mult: '约 1×', w: 1 / 20, pro: false, fit: ['日常聊天', '写文案、查资料', '偶尔写点代码'], color: '#2563eb' },
    { nm: 'Pro 5x', sb: '进阶档 · 重度使用', mult: '约 10×', badge: '已翻倍', w: 10 / 20, pro: true, fit: ['天天写代码', '跑长任务、深度研究', 'Plus 额度总不够'], color: '#7c3aed' },
    { nm: 'Pro 20x', sb: '顶配档 · 高强度', mult: '约 20×', w: 1, pro: true, fit: ['一整天高强度用', '多个任务同时跑', 'Pro 5x 也不够用'], color: '#a86b00' },
  ];
  const IC = {
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18h3"/><path d="M9.5 8.5h5M12 6v5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.2c2.8.4 5.2 2.7 5.2 5.8"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    me: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5 1.6 0 3 .5 4.1 1.4"/><path d="M18.5 10.5l-3 5h4l-3 5"/>',
  };
  const METHODS = [
    { short: '官方订阅', nm: '官方订阅', tg: '自己绑卡，按月扣费', ic: 'card', ok: ['最正规', '官方直接扣费，账单清楚'], ng: ['要有能境外支付的卡', '很多国内卡会被拒'] },
    { short: 'App Store', nm: '外区 App Store 内购', tg: '手机里订阅，苹果扣费', ic: 'phone', ok: ['走苹果扣费，很稳', '退订、续费都在手机里'], ng: ['要外区 Apple ID', '要买礼品卡，步骤多'] },
    { short: '共享号', nm: '共享号 / 拼车', tg: '几个人合用一个号', ic: 'users', ok: ['价格最低', '上手最快'], ng: ['聊天记录互相能看到', '额度被别人占，随时可能失效'] },
    { short: '成品号', nm: '成品号', tg: '买一个已开好会员的号', ic: 'box', ok: ['买来就能用', '不用自己折腾'], ng: ['不是你原来的号', '以前的记录和设置都不在'] },
    { short: '直充自己号', nm: '直充自己的号', tg: '代充 / 卡密，充到你自己的号上', ic: 'me', ok: ['会员在自己号上，记录都在', '不用自己弄卡'], ng: ['要提交登录凭证 (session)', '一定要挑靠谱的店'] },
  ];
  // [method, 上手门槛, 是自己的号, 隐私, 出问题找谁]  g = good, m = so-so, b = bad
  const TABLE = [
    ['官方订阅', ['b', '高 · 要境外卡'], ['g', '是'], ['g', '好'], ['g', '官方']],
    ['App Store 内购', ['m', '中 · 步骤多'], ['g', '是'], ['g', '好'], ['g', '苹果']],
    ['共享号 / 拼车', ['g', '低'], ['b', '不是'], ['b', '差'], ['b', '看车主']],
    ['成品号', ['g', '低'], ['b', '不是'], ['m', '一般'], ['m', '看店铺']],
    ['直充自己的号', ['g', '低'], ['g', '是'], ['m', '要交凭证'], ['m', '看店铺质保']],
  ];
  const CHECKS = [
    ['会员充在自己的号上', '记录、设置都是自己的'],
    ['官网能看到订阅和账单', '充完自己登录核对一遍'],
    ['质保写清楚', '掉了怎么赔、按什么算'],
    ['不交账号密码', '充完退出所有设备，再重新登录'],
    ['价格低得离谱要多问', '低价渠道容易被官方风控'],
  ];

  /* ---------------- build DOM ---------------- */
  const el = {};
  const reg = () => document.querySelectorAll('[id]').forEach(n => { el[n.id] = n; });
  {
    const box = document.getElementById('tiers');
    TIERS.forEach((x, i) => {
      const c = h('div', 'tier');
      c.id = 'tier' + i;
      c.innerHTML = `<div class="top"><div class="nm">${x.nm}</div><div class="sb">${x.sb}</div></div>
        <div class="row" id="tr0_${i}"><div class="lb">用量</div><div class="mult" id="tm${i}" style="color:${x.color}">${x.badge ? `<span class="bdg">${x.badge}</span>` : ''}${x.mult}</div><div class="bar"><i id="tb${i}"></i></div></div>
        <div class="row yn" id="tr1_${i}"><div class="lb">Pro 模型</div><div class="v ${x.pro ? 'y' : 'n'}">${x.pro ? '✓ 可用' : '—'}</div></div>
        <div class="fit" id="tf${i}" style="color:${x.color}"><div class="lb">适合</div><ul>${x.fit.map(f => `<li><span style="color:var(--ink)">${f}</span></li>`).join('')}</ul></div>
        <div class="dim" id="td${i}"></div>`;
      box.appendChild(c);
    });
    const steps = document.getElementById('mSteps');
    const cards = document.getElementById('mCards');
    METHODS.forEach((m, i) => {
      const s = h('div', 'ms', `<span class="c">${i + 1}</span>${m.short}`);
      s.id = 'ms' + i;
      steps.appendChild(s);
      const c = h('div', 'card mcard');
      c.id = 'mc' + i;
      c.innerHTML = `<div class="lp"><div class="no">0${i + 1}</div>
          <div class="ic"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ff5000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[m.ic]}</svg></div>
          <div class="nm">${m.nm}</div><div class="tg">${m.tg}</div></div>
        <div class="rp">
          <div class="grp ok" id="mo${i}"><span class="gh ok">优点</span><ul>${m.ok.map(x => `<li><span class="m">✓</span>${x}</li>`).join('')}</ul></div>
          <div class="grp ng" id="mn${i}"><span class="gh ng">门槛 / 风险</span><ul>${m.ng.map(x => `<li><span class="m">!</span>${x}</li>`).join('')}</ul></div>
        </div>`;
      cards.appendChild(c);
    });
    const tbl = document.getElementById('tbl');
    tbl.appendChild(h('div', 'tr th', '<div>开通方式</div><div>上手门槛</div><div>是自己的号</div><div>隐私</div><div>出问题找谁</div>'));
    TABLE.forEach((r, i) => {
      const row = h('div', 'tr');
      row.id = 'tr' + i;
      row.innerHTML = `<div class="k"><span class="c">${i + 1}</span>${r[0]}</div>` +
        r.slice(1).map(([k, v]) => `<div class="cell"><span class="pill ${k}"><i></i>${v}</span></div>`).join('') +
        `<div class="dim" id="trd${i}"></div><div class="ring" id="trr${i}"></div>`;
      tbl.appendChild(row);
    });
    const items = document.getElementById('chkItems');
    CHECKS.forEach(([a, b], i) => {
      const n = h('div', 'ci', `<div class="bx"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><div class="tx">${a}<small>${b}</small></div>`);
      n.id = 'ci' + i;
      items.appendChild(n);
    });
    document.getElementById('qrShopHolder').innerHTML = window.QR.shop;
  }
  reg();
  const FE = [0, 1, 2, 3].map(i => { const p = el['fe' + i]; const L = p.getTotalLength(); p.style.strokeDasharray = `${L}`; return { p, L }; });

  /* ---------------- sound effects ---------------- */
  const SFX = [];
  W.forEach(t => SFX.push({ t: t + 0.05, type: 'whoosh' }));
  SFX.push({ t: 0.2, type: 'impact', gain: 0.8 });
  const HK_T = [T.h2.a + 0.1, T.h2.a + 1.0];
  HK_T.forEach(t => SFX.push({ t, type: 'pop' }));
  const TIER_IN = TIERS.map((_, i) => SW[0] + 0.35 + i * 0.25);
  TIER_IN.forEach(t => SFX.push({ t, type: 'pop', gain: 0.7 }));
  const BAR_T = TIERS.map((_, i) => T.p3a.a + 0.4 + i * 0.45);
  BAR_T.forEach(t => SFX.push({ t, type: 'tick' }));
  const FA = T.p7a.a;
  const FLOW = { q1: FA - 0.1, e0: FA + 0.5, plus: FA + 0.8, e1: FA + 1.25, q2: FA + 1.55, e2: FA + 2.1, pro5: FA + 2.35, e3: FA + 2.65, pro20: FA + 2.9, tip: T.p7b.a + 0.1 };
  ['q1', 'plus', 'q2', 'pro5', 'pro20', 'tip'].forEach(k => SFX.push({ t: FLOW[k], type: 'pop', gain: 0.6 }));
  const M_IN = METHODS.map((_, i) => T[`m${i + 1}a`].a - 0.25);
  M_IN.forEach((t, i) => i > 0 && SFX.push({ t, type: 'whoosh', gain: 0.35 }));
  [0, 1, 2, 3, 4].forEach(i => SFX.push({ t: T.m0.a + 0.5 + i * 0.22, type: 'pop', gain: 0.45 }));
  SFX.push({ t: T.s1.a + 0.9, type: 'tick' });
  SFX.push({ t: T.s2.a + 0.3, type: 'tick' });
  const CHK_T = CHECKS.map((_, i) => T['c' + (i + 1)].a + 0.15);
  CHK_T.forEach(t => SFX.push({ t, type: 'tick', gain: 1.2 }));
  if (SHOP) [0, 1, 2, 3, 4, 5].forEach(i => SFX.push({ t: OUT0 + 1.6 + i * 0.15, type: 'pop', gain: 0.45 }));
  else {
    [0, 1, 2].forEach(i => SFX.push({ t: OUT0 + 0.7 + i * 0.25, type: 'pop', gain: 0.5 }));
    [0, 1, 2].forEach(i => SFX.push({ t: T.o2.a + 2.0 + i * 0.2, type: 'pop', gain: 0.5 }));
  }
  SFX.push({ t: T.o3.a, type: 'notify' });
  SFX.sort((a, b) => a.t - b.t);

  /* ---------------- fonts ---------------- */
  const glyphs = h('div', null, CAPS.map(c => c[2]).join(' ') + ' PART 0123456789×✓—!·：+-ABCDEFGHIJKLMNOPQRSTUVWXYZ' + PARTS.map(p => p[3]).join(''));
  glyphs.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;font-weight:700';
  document.body.appendChild(glyphs);
  const ready = (async () => {
    const text = document.body.innerText + glyphs.innerText;
    const loads = [];
    for (const w of [400, 500, 700, 900]) loads.push(document.fonts.load(`${w} 40px "Noto Sans SC"`, text));
    loads.push(document.fonts.load(`400 100px "ZCOOL QingKe HuangYou"`, text));
    await Promise.all(loads);
    await document.fonts.ready;
    return true;
  })();

  /* ---------------- render ---------------- */
  let lastCap = -1, lastPart = -1;
  const popIn = (n, t, a, from = 0.6, pre = '') => { op(n, clamp((t - a) / 0.15)); n.style.transform = `${pre}scale(${from + (1 - from) * seg(t, a, a + 0.4, 'back')})`; };
  const C = 'translate(-50%, -50%) ';
  const riseIn = (n, t, a, dy = 30, d = 0.45) => { const k = seg(t, a, a + d, 'out'); op(n, clamp((t - a) / (d * 0.6))); n.style.transform = `translateY(${(1 - k) * dy}px)`; return k; };

  function seek(t) {
    css(el.glow1, { transform: `translate(${-200 + 260 * Math.sin(t * 0.17)}px, ${-260 + 160 * Math.cos(t * 0.13)}px)` });
    css(el.glow2, { transform: `translate(${1150 + 220 * Math.cos(t * 0.11)}px, ${380 + 180 * Math.sin(t * 0.15)}px)` });
    for (const id in SCENES) { const [a, b] = SCENES[id]; op(el[id], vis(t, a, b, 0.35)); }

    /* hook */
    if (t < SW[0] + 0.5) {
      riseIn(el.hkTitle, t, 0.15, 50, 0.7);
      HK_T.forEach((a, i) => popIn(el['hk' + i], t, a, 0.8));
      [0, 1].forEach(i => riseIn(el['hw' + i], t, T.h3.a + 0.2 + i * 1.2, 16, 0.35));
    }

    /* PART 1: tiers */
    if (t > SCENES['s-tiers'][0] - 0.5 && t < SCENES['s-tiers'][1] + 0.5) {
      TIERS.forEach((x, i) => {
        const a = TIER_IN[i];
        const k = seg(t, a, a + 0.55, 'out');
        op(el['tier' + i], clamp((t - a) / 0.25));
        el['tier' + i].style.transform = `translateY(${(1 - k) * 70}px)`;
        riseIn(el[`tr0_${i}`], t, T.p2.a + 0.2 + i * 0.12, 14, 0.35);
        riseIn(el[`tr1_${i}`], t, T.p2.a + 1.9 + i * 0.12, 14, 0.35);
        const f = seg(t, BAR_T[i], BAR_T[i] + 0.8, 'out');
        el['tb' + i].style.width = `${Math.max(f * x.w * 100, f > 0 ? 2.2 : 0)}%`;
        op(el['tm' + i], clamp((t - BAR_T[i] - 0.3) / 0.25));
        riseIn(el['tf' + i], t, T[`p${i + 4}`].a + 0.1, 20, 0.4);
      });
      op(el.tierNote, vis(t, T.p3b.a, 1e9, 0.3));
      el.tierNote.style.transform = `scale(${1 + 0.08 * (1 - seg(t, T.p3b.a, T.p3b.a + 0.4, 'out'))})`;
      // focus ring + dim others while each tier is described
      let fi = -1;
      for (let i = 0; i < 3; i++) if (t >= T[`p${i + 4}`].a - 0.15 && t < (i < 2 ? T[`p${i + 5}`].a - 0.15 : T.p6.b + 0.2)) fi = i;
      const ringOn = vis(t, T.p4.a - 0.15, T.p6.b + 0.2, 0.25);
      op(el.tierRing, ringOn);
      const xs = [0, 1, 2].map(i => 150 + i * 560 - 7);
      const tx = track(t, [[T.p4.a - 0.15, xs[0]], [T.p5.a - 0.15, xs[0]], [T.p5.a + 0.25, xs[1]], [T.p6.a - 0.15, xs[1]], [T.p6.a + 0.25, xs[2]]]);
      css(el.tierRing, { left: tx + 'px', width: '514px', top: '123px', height: '694px' });
      for (let i = 0; i < 3; i++) op(el['td' + i], ringOn * (fi >= 0 && fi !== i ? 1 : 0) * 0.85 + 0);
    }

    /* PART 1: flow */
    if (t > SCENES['s-flow'][0] - 0.5 && t < SCENES['s-flow'][1] + 0.5) {
      popIn(el.fnQ1, t, FLOW.q1, 0.8, C);
      popIn(el.fnPlus, t, FLOW.plus, 0.7, C);
      popIn(el.fnQ2, t, FLOW.q2, 0.8, C);
      popIn(el.fnPro5, t, FLOW.pro5, 0.7, C);
      popIn(el.fnPro20, t, FLOW.pro20, 0.7, C);
      [['e0', 'fl0'], ['e1', 'fl1'], ['e2', 'fl2'], ['e3', 'fl3']].forEach(([e, l], i) => {
        const p = seg(t, FLOW[e], FLOW[e] + 0.5, 'io');
        FE[i].p.style.strokeDashoffset = `${FE[i].L * (1 - p)}`;
        FE[i].p.style.opacity = p > 0 ? 1 : 0;
        popIn(el[l], t, FLOW[e] + 0.2, 0.6, C);
      });
      const k = seg(t, FLOW.tip, FLOW.tip + 0.5, 'back');
      op(el.fnTip, clamp((t - FLOW.tip) / 0.2));
      el.fnTip.style.transform = `rotate(-2.5deg) scale(${0.7 + 0.3 * k})`;
    }

    /* PART 2: methods */
    if (t > SCENES['s-methods'][0] - 0.5 && t < SCENES['s-methods'][1] + 0.5) {
      let mi = -1;
      for (let i = 0; i < 5; i++) if (t >= M_IN[i]) mi = i;
      METHODS.forEach((m, i) => {
        const s = el['ms' + i];
        const a = T.m0.a + 0.5 + i * 0.22;
        popIn(s, t, a, 0.7);
        s.className = 'ms' + (i === mi ? ' on' : '');
        // card i: in at M_IN[i], out at M_IN[i+1]
        const c = el['mc' + i];
        const a0 = M_IN[i], a1 = i < 4 ? M_IN[i + 1] : 1e9;
        const kin = seg(t, a0, a0 + 0.5, 'out'), kout = seg(t, a1, a1 + 0.45, 'io');
        op(c, Math.min(clamp((t - a0) / 0.25), 1 - kout));
        c.style.transform = `translateX(${(1 - kin) * 260 - kout * 320}px) scale(${0.97 + 0.03 * kin})`;
        riseIn(el['mo' + i], t, T[`m${i + 1}a`].a + 0.5, 18, 0.4);
        riseIn(el['mn' + i], t, T[`m${i + 1}b`].a + 0.1, 18, 0.4);
      });
    }

    /* PART 2: table */
    if (t > SCENES['s-table'][0] - 0.5 && t < SCENES['s-table'][1] + 0.5) {
      const a = SCENES['s-table'][0];
      const k = seg(t, a, a + 0.6, 'out');
      op(el.tbl, clamp((t - a) / 0.3));
      el.tbl.style.transform = `translateY(${(1 - k) * 50}px) scale(${0.97 + 0.03 * k})`;
      op(el.tblTitle, clamp((t - a - 0.8) / 0.4));
      const hlA = [0, 1], hlB = [4];
      const onA = vis(t, T.s1.a + 0.9, T.s2.a + 0.05, 0.25), onB = vis(t, T.s2.a + 0.3, 1e9, 0.25);
      for (let i = 0; i < 5; i++) {
        const lit = hlA.includes(i) ? onA : hlB.includes(i) ? onB : 0;
        op(el['trr' + i], lit);
        op(el['trd' + i], Math.max(onA, onB) * (1 - lit) * 0.9);
      }
    }

    /* PART 3: checklist */
    if (t > SCENES['s-chk'][0] - 0.5 && t < SCENES['s-chk'][1] + 0.5) {
      const a = SCENES['s-chk'][0];
      const k = seg(t, a, a + 0.6, 'out');
      op(el.chk, clamp((t - a) / 0.3));
      el.chk.style.transform = `translateY(${(1 - k) * 50}px)`;
      CHECKS.forEach((_, i) => {
        const n = el['ci' + i], c = CHK_T[i];
        const on = t >= c;
        n.classList.toggle('on', on);
        n.style.opacity = (0.28 + 0.72 * seg(t, c - 0.1, c + 0.2, 'out')).toFixed(3);
        const s = n.querySelector('svg');
        s.style.opacity = on ? 1 : 0;
        s.style.transform = `scale(${on ? 0.5 + 0.5 * seg(t, c, c + 0.35, 'back') : 0.5})`;
        n.querySelector('.bx').style.transform = `scale(${t >= c && t < c + 0.15 ? 1.12 : 1})`;
      });
    }

    /* outro */
    if (t > OUT0 - 0.6 && SHOP) {
      riseIn(el.outTitle, t, OUT0 + 0.2, 40, 0.6);
      riseIn(el.outSub, t, OUT0 + 0.6, 40, 0.6);
      Array.from(el.outChips.children).forEach((c, i) => riseIn(c, t, OUT0 + 1.6 + i * 0.15, 20, 0.3));
      const q = seg(t, OUT0 + 0.8, OUT0 + 1.5, 'out');
      op(el.qrCard, q); el.qrCard.style.transform = `translateX(${(1 - q) * 90}px)`;
      popIn(el.outAsk, t, T.o3.a, 0.7);
      op(el.disclaimer, clamp((t - OUT0 - 2.4) / 0.5));
    }
    if (t > OUT0 - 0.6 && !SHOP) {
      riseIn(el.ocTitle, t, OUT0 + 0.2, 40, 0.6);
      [0, 1, 2].forEach(i => riseIn(el['ocr' + i], t, OUT0 + 0.7 + i * 0.25, 30, 0.45));
      const q = seg(t, T.o2.a + 1.6, T.o2.a + 2.2, 'out');
      op(el.ocLike, q); el.ocLike.style.transform = `translateX(${(1 - q) * 90}px)`;
      [0, 1, 2].forEach(i => popIn(el['ol' + i], t, T.o2.a + 2.0 + i * 0.2, 0.5));
      popIn(el.ocAsk, t, T.o3.a, 0.7);
      op(el.disclaimer, clamp((t - OUT0 - 2.4) / 0.5));
    }

    /* HUD */
    let pi = -1;
    for (let i = 0; i < PARTS.length; i++) if (t >= PARTS[i][0] && t < PARTS[i][1]) pi = i;
    const hv = vis(t, HUD_VIS[0], HUD_VIS[1], 0.35);
    op(el.part, hv); op(el.prog, hv);
    if (pi >= 0 && pi !== lastPart) {
      el.partK.textContent = PARTS[pi][2]; el.partL.textContent = PARTS[pi][3];
      const cur = PARTS[pi][4];
      [0, 1, 2].forEach(i => { el['pn_' + i].className = 'pn' + (i < cur ? ' done' : i === cur ? ' on' : ''); el['pn_' + i].firstElementChild.textContent = i < cur ? '✓' : String(i + 1); });
      lastPart = pi;
    }
    if (pi >= 0) { const k = seg(t, PARTS[pi][0], PARTS[pi][0] + 0.3, 'out'); el.part.style.transform = `translateX(${(1 - k) * -24}px)`; }

    /* AI voice label: visible for the whole video */
    op(el.aiTag, 1);

    /* captions */
    let k2 = -1;
    for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][0] && t < CAPS[i][1]) k2 = i;
    if (k2 !== lastCap) { if (k2 >= 0) el.cap.innerHTML = CAPS[k2][2]; lastCap = k2; }
    if (k2 >= 0) {
      const [a, b] = CAPS[k2];
      op(el.cap, vis(t, a, b, 0.18));
      el.cap.style.transform = `translateX(-50%) translateY(${(1 - seg(t, a, a + 0.3, 'out')) * 18}px)`;
    } else op(el.cap, 0);

    /* transitions */
    let wp = -1;
    for (const w of W) if (t >= w && t < w + 0.6) wp = (t - w) / 0.6;
    if (wp >= 0) { op(el.wipe, 0.85); el.wipe.style.left = `${lerp(-1300, 2300, E.io(wp))}px`; } else op(el.wipe, 0);
    op(el.fade, Math.max(seg(t, DURATION - 0.9, DURATION, 'lin'), 1 - clamp(t / 0.25)));
  }
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i];
      if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, E.io(clamp((t - t0) / (t1 - t0 || 1e-6)))); }
    }
    return keys[keys.length - 1][1];
  }

  window.FPS = FPS;
  window.DURATION = DURATION;
  window.SFX = SFX;
  window.MUSIC = MUSIC;
  window.CAPTIONS = CAPS.map(([a, b, x]) => ({ start: +a.toFixed(2), end: +b.toFixed(2), text: x.replace(/<[^>]+>/g, '') }));
  window.TIMES = T;
  window.VOICE_CUES = VOICE_CUES;
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

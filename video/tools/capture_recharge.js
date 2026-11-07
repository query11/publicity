// Capture the self-service recharge site (chong.cccard.uk) in every state of the flow.
// "GPT" wording is replaced by "Plus" (or removed) before every screenshot.
// All /api/ calls are answered locally with demo data (page.route) — no CDK, session or
// any other data is ever sent to the site's backend. Amounts (plan list price) are blurred.
//   node tools/capture_recharge.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE = 'https://chong.cccard.uk/';
const CDK = 'PLUS-7XK2-M9QF-4TBA';                // demo code, matches the site's CDK format
const EMAIL = 'demo@example.com';
const SESSION = JSON.stringify({ user: { email: EMAIL }, expires: '2026-12-07T00:00:00.000Z', accessToken: 'demo-access-token-for-video-only-0000000000' }, null, 2);
const OUT = path.resolve(__dirname, '..', 'assets', 'recharge');
fs.mkdirSync(OUT, { recursive: true });
const PARK = [1430, 890];

let jobStatus = 'queued';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DELAY = { preview: 1600, token: 1600 };

function mock(url, method) {
  const p = new URL(url).pathname.replace(/^\/api\/v2/, '');
  if (p === '/redeem/maintenance') return { enabled: false };
  if (p === '/redeem/preview') return { ok: true, plan: 'plus', status: 'available', redeem_code: CDK };
  if (p === '/recharge/token-check') return { ok: true, email: EMAIL, verified_email: EMAIL, plan: 'free', current_plan: 'free', can_submit: true, already_satisfied: false, eligibility_code: 'eligible' };
  if (p === '/recharge/submit' || p === '/recharge/submission-recovery') return { job_id: 'job-demo-0001', lookup_token: 'demo-lookup-token-0000000000', status: 'queued', plan: 'plus', email: EMAIL };
  if (/\/acknowledge$/.test(p)) return { ok: true };
  if (/\/logs/.test(p)) return { logs: [], items: [], next_after_id: 0 };
  if (/\/challenge/.test(p)) return { challenge: null };
  if (/^\/recharge\/jobs\//.test(p)) return { job_id: 'job-demo-0001', status: jobStatus, plan: 'plus', email: EMAIL, account_email: EMAIL, created_at: '2026-11-07T06:30:00Z', updated_at: '2026-11-07T06:31:00Z', succeeded_at: jobStatus === 'succeeded' ? '2026-11-07T06:32:00Z' : null };
  return { ok: true };
}

// Show "Plus" only: drop every "GPT" wording (edited in place so the page keeps updating).
function dropGpt() {
  const rules = [
    [/Chat\s*GPT\s*会员自助充值/g, 'Plus 会员自助充值'],
    [/Chat\s*GPT\s+Plus/gi, 'Plus'],
    [/Chat\s*GPT\s+Free/gi, 'Free'],
    [/登录您的\s*Chat\s*GPT\s*账号/g, '登录您的账号'],
    [/登录\s*Chat\s*GPT/g, '登录账号'],
    [/Chat\s*GPT\s*/gi, ''],
    [/\bGPT\b\s*/g, ''],
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!/gpt/i.test(n.nodeValue)) continue;
    let v = n.nodeValue;
    for (const [re, to] of rules) v = v.replace(re, to);
    n.nodeValue = v;
  }
}

function maskAmounts() {
  const re = /((?:US)?[$＄]\s*\d[\d,]*(?:\.\d+)?|[¥￥]\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:刀|美元|美金|元|USD))/g;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const p = n.parentElement;
    if (!p || p.dataset.masked || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(p.tagName)) continue;
    re.lastIndex = 0;
    if (!re.test(n.nodeValue)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(n.nodeValue))) {
      frag.append(n.nodeValue.slice(last, m.index));
      const s = document.createElement('span');
      s.dataset.masked = '1';
      s.textContent = m[0];
      s.style.cssText = 'filter:blur(6px);display:inline-block';
      frag.append(s);
      last = m.index + m[0].length;
    }
    frag.append(n.nodeValue.slice(last));
    n.replaceWith(frag);
  }
  // the session textarea holds a credential: always shown blurred
  const ta = document.querySelector('#chatgpt-token');
  if (ta) ta.style.filter = ta.value ? 'blur(4px)' : '';
}

const box = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  const page = await ctx.newPage();
  const seen = [];
  await page.route('**/*', async route => {
    const req = route.request();
    if (/\/api\//.test(req.url())) {
      const p = new URL(req.url()).pathname;
      seen.push(req.method() + ' ' + p);
      if (p.endsWith('/redeem/preview')) await sleep(DELAY.preview);
      if (p.endsWith('/recharge/token-check')) await sleep(DELAY.token);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock(req.url(), req.method())) });
    }
    if (/challenges\.cloudflare\.com|google-analytics|googletagmanager/.test(req.url())) return route.abort();
    return route.continue();
  });
  const shot = async (name) => { await page.evaluate(dropGpt); await page.evaluate(maskAmounts); const left = await page.evaluate(() => /gpt/i.test(document.body.innerText)); if (left) throw new Error('GPT text still visible in ' + name); await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
  const text = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 900));
  const geo = {};

  await page.goto(SITE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('#redeem-code').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(...PARK);
  await shot('r00_base');
  geo.cdk = await box(page, '#redeem-code');
  geo.session = await box(page, '#chatgpt-token');
  geo.guide = await box(page, 'text=使用指南');
  geo.openSession = await box(page, 'text=打开 session');
  geo.submit = await box(page, 'text=开始充值');

  // CDK: focus, paste
  await page.locator('#redeem-code').click();
  await page.mouse.move(...PARK);
  await page.waitForTimeout(300);
  await shot('r01_cdk_focus');
  await page.locator('#redeem-code').fill(CDK);
  await page.waitForTimeout(500);
  await shot('r02_cdk_checking');
  await page.waitForTimeout(DELAY.preview + 800);
  await shot('r03_cdk_ok');
  console.log('after cdk:', await text());

  // hover the guide's "打开 session"
  await page.mouse.move(geo.openSession.x + geo.openSession.w / 2, geo.openSession.y + geo.openSession.h / 2);
  await page.waitForTimeout(400);
  await shot('r04_guide_hover');

  // session: focus, paste
  await page.locator('#chatgpt-token').click();
  await page.mouse.move(...PARK);
  await page.waitForTimeout(300);
  await shot('r05_session_focus');
  await page.locator('#chatgpt-token').fill(SESSION);
  await page.waitForTimeout(500);
  await shot('r06_session_checking');
  await page.waitForTimeout(DELAY.token + 800);
  await page.mouse.click(700, 120); // blur the textarea on empty page area
  await page.mouse.move(...PARK);
  await page.waitForTimeout(500);
  await shot('r07_session_ok');
  console.log('after session:', await text());
  geo.submit = await box(page, 'text=开始充值');
  geo.status = await box(page, 'text=等待提交');

  // start
  await page.mouse.move(geo.submit.x + geo.submit.w / 2, geo.submit.y + geo.submit.h / 2);
  await page.waitForTimeout(400);
  await shot('r08_submit_hover');
  await page.locator('.submit-btn, button:has-text("开始充值")').first().click();
  await page.locator('.confirm-modal').waitFor({ timeout: 15000 }).catch(() => console.log('no modal; text:', ''));
  await page.waitForTimeout(800);
  await page.mouse.move(...PARK);
  await page.waitForTimeout(300);
  await shot('r09_confirm');
  console.log('confirm modal:', await text());
  const btns = await page.locator('.confirm-modal button').allInnerTexts();
  console.log('modal buttons', btns);
  const confirmSel = '.confirm-modal button:has-text("提交"), .confirm-modal button:has-text("确认")';
  geo.modal = await box(page, '.confirm-modal');
  geo.modalConfirm = await box(page, confirmSel);
  if (geo.modalConfirm) {
    await page.mouse.move(geo.modalConfirm.x + geo.modalConfirm.w / 2, geo.modalConfirm.y + geo.modalConfirm.h / 2);
    await page.waitForTimeout(400);
    await shot('r10_confirm_hover');
    jobStatus = 'queued';
    await page.locator(confirmSel).last().click();
    await page.waitForTimeout(2500);
    await page.mouse.move(...PARK);
    await shot('r11_queued');
    console.log('queued:', await text());
    jobStatus = 'processing';
    await page.waitForTimeout(6000);
    await shot('r12_processing');
    console.log('processing:', await text());
    jobStatus = 'succeeded';
    await page.waitForTimeout(6000);
    await shot('r13_succeeded');
    console.log('succeeded:', await text());
    geo.statusAfter = await box(page, 'text=充值成功');
  }
  fs.writeFileSync(path.join(OUT, 'geo.json'), JSON.stringify(geo, null, 1));
  console.log(JSON.stringify(geo));
  console.log('API calls answered locally:', [...new Set(seen)].join(', '));
  await browser.close();
})();

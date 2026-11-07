// Capture the real UI states of the shop (2x, 1440x900 CSS px) used by the promo video.
// All monetary amounts are blurred in-page before every screenshot (prices, totals, "200$", "100刀"...).
// Never submits an order or an order query.
//   node tools/capture.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOP = 'https://www.16688.com.cn/shop/S382939';
const EMAIL = 'demo@example.com';
const A = path.resolve(__dirname, '..', 'assets');
for (const d of ['shot', 'type', 'oq']) fs.mkdirSync(path.join(A, d), { recursive: true });
const out = (...p) => path.join(A, ...p);
const pad = i => String(i).padStart(2, '0');
const PARK = [1430, 890]; // where the real mouse waits so it never shows hover states by accident

// Blur every price / amount on the page (idempotent).
function maskAmounts() {
  document.querySelectorAll('.card-price, .price, .total-price-wrap, .total-price').forEach(e => { e.style.filter = 'blur(7px)'; });
  const re = /([¥￥]\s*\d[\d,]*(?:\.\d+)?|\$\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:\$|刀|美元|美金|元|USD))/g;
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
      s.style.cssText = 'filter:blur(5px);display:inline-block';
      frag.append(s);
      last = m.index + m[0].length;
    }
    frag.append(n.nodeValue.slice(last));
    n.replaceWith(frag);
  }
}

async function openShop(ctx, vh = 900) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: vh });
  for (let i = 0; i < 3; i++) {
    await page.goto(SHOP, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    if (await page.locator('text=/已售16000\\+/').first().waitFor({ timeout: 20000 }).then(() => true, () => false)) break;
  }
  await page.waitForTimeout(2000);
  return page;
}
async function openModal(page) {
  for (let i = 0; i < 4; i++) {
    await page.locator('text=/已售16000\\+/').first().click();
    if (await page.locator('.detail').waitFor({ timeout: 6000 }).then(() => true, () => false)) break;
  }
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.detail img')).every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}
async function shot(page, file, clip) {
  await page.evaluate(maskAmounts);
  await page.waitForTimeout(120);
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  await ctx.route(/hm\.baidu\.com/, r => r.abort());
  const geo = {};

  // ---- shop page, hover, order modal, typing, filled, confirm hover
  {
    const page = await openShop(ctx);
    await page.mouse.move(...PARK);
    await shot(page, out('shot', '01_shop.png'));
    await shot(page, out('shot', 'avatar.png'), { x: 32, y: 132, width: 108, height: 108 });
    await shot(page, out('shot', 'product.png'), { x: 447, y: 335, width: 184, height: 184 });
    await page.mouse.move(539, 470);
    await page.waitForTimeout(700);
    await shot(page, out('shot', '02_shop_hover.png'));
    await openModal(page);
    await page.mouse.move(...PARK);
    await page.waitForTimeout(300);
    await shot(page, out('shot', '03_modal.png'));
    geo.desc = await page.evaluate(() => { const r = document.querySelector('.detail').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const email = page.locator('input[placeholder*="邮箱"]');
    geo.email = await email.boundingBox();
    await email.click();
    await page.mouse.move(...PARK);
    await page.waitForTimeout(400);
    await shot(page, out('shot', '05_email_focus.png'));
    const TYPE_CLIP = { x: 672, y: 590, width: 328, height: 44 };
    for (let i = 1; i <= EMAIL.length; i++) {
      await email.fill(EMAIL.slice(0, i));
      await page.waitForTimeout(80);
      await shot(page, out('type', `t${pad(i)}.png`), TYPE_CLIP);
    }
    await page.mouse.click(720, 681); // empty strip between the coupon row and 支付方式: blurs the input, touches no control
    await page.mouse.move(...PARK);
    await page.waitForTimeout(1500);
    await shot(page, out('shot', '07_modal_filled.png'));
    const confirm = page.locator('text=确认订单').last();
    geo.confirm = await confirm.boundingBox();
    await page.mouse.move(geo.confirm.x + geo.confirm.width / 2, geo.confirm.y + geo.confirm.height / 2);
    await page.waitForTimeout(500);
    await shot(page, out('shot', '09_confirm_hover.png'));
    await page.close();
  }

  // ---- full-height description (for the scroll animation), seamless
  {
    const page = await openShop(ctx);
    await openModal(page);
    await page.evaluate(maskAmounts);
    const sh = await page.evaluate(() => document.querySelector('.detail').scrollHeight);
    await page.setViewportSize({ width: 1440, height: Math.ceil(sh + 900) });
    await page.evaluate(() => { const d = document.querySelector('.detail'); d.style.maxHeight = 'none'; d.style.height = d.scrollHeight + 'px'; d.style.overflow = 'visible'; });
    await page.waitForTimeout(800);
    await page.evaluate(maskAmounts);
    await page.locator('.detail').screenshot({ path: out('shot', 'desc_tall.png') });
    geo.descScrollHeight = sh;
    await page.close();
  }

  // ---- order query page: base, focus, typing, button hover (nothing is submitted)
  {
    const page = await openShop(ctx);
    await page.locator('text=订单查询').first().click();
    await page.locator('text=查询订单').last().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.mouse.move(...PARK);
    await shot(page, out('shot', '10_order_query.png'));
    const inp = page.locator('input').first();
    await inp.click();
    await page.mouse.move(...PARK);
    await page.waitForTimeout(400);
    await shot(page, out('shot', '11_order_query_focus.png'));
    const OQ_CLIP = { x: 288, y: 310, width: 864, height: 66 };
    for (let i = 1; i <= EMAIL.length; i++) {
      await inp.fill(EMAIL.slice(0, i));
      await page.waitForTimeout(80);
      await shot(page, out('oq', `q${pad(i)}.png`), OQ_CLIP);
    }
    const qb = await page.locator('text=查询订单').last().boundingBox();
    await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height / 2);
    await page.waitForTimeout(400);
    await shot(page, out('oq', 'q_hover.png'), OQ_CLIP);
    await page.close();
  }

  fs.writeFileSync(path.join(A, 'geo.json'), JSON.stringify(geo, null, 1));
  console.log(JSON.stringify(geo));
  await browser.close();
})();

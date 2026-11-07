// Capture the 16688 pages used by the video (2x, 1440x900 CSS px):
//   - the shop avatar (outro / cover)
//   - the order-query page: base, focus, per-character typing crops, button hover
// Nothing is submitted.
//   node tools/capture.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOP = 'https://www.16688.com.cn/shop/S382939';
const EMAIL = 'demo@example.com';
const A = path.resolve(__dirname, '..', 'assets');
for (const d of ['shot', 'oq']) fs.mkdirSync(path.join(A, d), { recursive: true });
const out = (...p) => path.join(A, ...p);
const pad = i => String(i).padStart(2, '0');
const PARK = [1430, 890];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  await ctx.route(/hm\.baidu\.com/, r => r.abort());
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) {
    await page.goto(SHOP, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    if (await page.locator('text=订单查询').first().waitFor({ timeout: 20000 }).then(() => true, () => false)) break;
  }
  await page.waitForTimeout(1500);
  await page.mouse.move(...PARK);
  await page.screenshot({ path: out('shot', 'avatar.png'), clip: { x: 32, y: 132, width: 108, height: 108 } });

  await page.locator('text=订单查询').first().click();
  await page.locator('text=查询订单').last().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(...PARK);
  await page.screenshot({ path: out('shot', '10_order_query.png') });
  const inp = page.locator('input').first();
  await inp.click();
  await page.mouse.move(...PARK);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('shot', '11_order_query_focus.png') });
  const OQ_CLIP = { x: 288, y: 310, width: 864, height: 66 };
  for (let i = 1; i <= EMAIL.length; i++) {
    await inp.fill(EMAIL.slice(0, i));
    await page.waitForTimeout(80);
    await page.screenshot({ path: out('oq', `q${pad(i)}.png`), clip: OQ_CLIP });
  }
  const qb = await page.locator('text=查询订单').last().boundingBox();
  await page.mouse.move(qb.x + qb.width / 2, qb.y + qb.height / 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('oq', 'q_hover.png'), clip: OQ_CLIP });
  console.log('captured avatar + order query');
  await browser.close();
})();

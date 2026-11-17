// Render the Bilibili cover image.  node tools/cover.js dist/cover.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // node tools/cover.js out.png [page]   page = cover.html (default) or cover-hook.html
  await page.goto('file://' + path.resolve(__dirname, '..', 'stage', process.argv[3] || 'cover.html'));
  await page.evaluate(() => window.STAGE_READY);
  await page.screenshot({ path: process.argv[2] || 'cover.png' });
  await browser.close();
  console.log('cover written');
})();

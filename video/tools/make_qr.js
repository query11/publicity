// Generates stage/qr.js with inline SVG QR codes.
//  - shop: the real shop link (used in the outro, scannable)
//  - pay:  a decorative demo code for the illustrated payment step (decodes to a "demo" note, not a payment)
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const SHOP_URL = 'https://www.16688.com.cn/shop/S382939';
const PAY_DEMO = '演示画面 · 非真实收款码 · plus小店 www.16688.com.cn/shop/S382939';

(async () => {
  const opts = { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#14161b', light: '#ffffff' } };
  const shop = await QRCode.toString(SHOP_URL, opts);
  const pay = await QRCode.toString(PAY_DEMO, { ...opts, errorCorrectionLevel: 'L' });
  const out = `window.QR = ${JSON.stringify({ shop, pay })};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'stage', 'qr.js'), out);
  console.log('wrote stage/qr.js');
})();

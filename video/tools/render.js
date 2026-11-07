// Render the stage to PNG stills or to an H.264 video (frames piped straight into ffmpeg).
//   node tools/render.js stills out/stills 1.5 14 31.8 ...
//   node tools/render.js video  out/video_silent.mp4 [workers=3] [from=0] [to=DURATION]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGE = 'file://' + path.join(ROOT, 'stage', 'index.html');

async function openStage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(STAGE);
  await page.evaluate(() => window.STAGE_READY);
  return page;
}

function ffmpegSink(out, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { ff, done };
}

async function renderRange(browser, f0, f1, fps, out, label) {
  const page = await openStage(browser);
  const { ff, done } = ffmpegSink(out, fps);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.seek(t), f / fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(`[${label}] frame ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  await page.close();
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch();
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const page = await openStage(browser);
    for (const s of rest) {
      const t = parseFloat(s);
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`) });
    }
    console.log('stills done');
  } else if (mode === 'meta') {
    const page = await openStage(browser);
    const meta = await page.evaluate(() => ({ fps: window.FPS, duration: window.DURATION, music: window.MUSIC, sfx: window.SFX, captions: window.CAPTIONS }));
    fs.writeFileSync(out, JSON.stringify(meta, null, 1));
    console.log('meta written', meta.sfx.length, 'sfx', meta.captions.length, 'captions');
  } else if (mode === 'video') {
    const page = await openStage(browser);
    const { fps, duration } = await page.evaluate(() => ({ fps: window.FPS, duration: window.DURATION }));
    await page.close();
    const workers = parseInt(rest[0] || '3', 10);
    const from = parseFloat(rest[1] || '0'), to = parseFloat(rest[2] || String(duration));
    const F0 = Math.round(from * fps), F1 = Math.round(to * fps);
    const per = Math.ceil((F1 - F0) / workers);
    const tmp = out + '.parts';
    fs.mkdirSync(tmp, { recursive: true });
    const parts = [];
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      const a = F0 + w * per, b = Math.min(F1, a + per);
      if (a >= b) break;
      const p = path.join(tmp, `part${w}.mp4`);
      parts.push(p);
      jobs.push(renderRange(browser, a, b, fps, p, 'w' + w));
    }
    await Promise.all(jobs);
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, parts.map(p => `file '${path.resolve(p)}'`).join('\n'));
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', c => (c === 0 ? res() : rej(new Error('concat ' + c)))));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('video written', out);
  }
  await browser.close();
})();

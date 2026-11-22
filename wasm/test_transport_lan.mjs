import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://192.168.0.43:8790/', { waitUntil: 'networkidle0' });
await page.click('#start');
await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Hz'), { timeout: 20000 });

// touch a white key
const keyBox = await page.$eval('#keyboard .key.white:nth-child(8)', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height * 0.8 };
});
await page.touchscreen.touchStart(keyBox.x, keyBox.y);
await new Promise((r) => setTimeout(r, 400));
const keyOn = await page.evaluate(() => document.querySelectorAll('.key.on').length);
await page.touchscreen.touchEnd();

const res = await page.evaluate(async () => {
  const o = window.__opvyn;
  const peak = async (ms = 500) => {
    await new Promise((r) => setTimeout(r, ms));
    const b = new Float32Array(o.analyser.fftSize);
    o.analyser.getFloatTimeDomainData(b);
    let p = 0;
    for (const v of b) p = Math.max(p, Math.abs(v));
    return +p.toFixed(3);
  };
  o.post({ type: 'engine', value: 2 });
  o.post({ type: 'select_track', value: 0 });
  o.post({ type: 'record', value: 1 });
  o.post({ type: 'play', value: 1 });
  o.post({ type: 'noteOn', note: 60 }); o.post({ type: 'noteOn', note: 64 });
  await new Promise((r) => setTimeout(r, 1500));
  o.post({ type: 'noteOff', note: 60 }); o.post({ type: 'noteOff', note: 64 });
  o.post({ type: 'record', value: 0 });
  o.post({ type: 'play', value: 0 });
  const recorded = await peak(300);
  o.post({ type: 'seek', value: 0 });
  o.post({ type: 'play', value: 1 });
  const playback = await peak(700);
  await new Promise((r) => setTimeout(r, 300));
  const pos = document.querySelector('#pos').textContent;
  o.post({ type: 'play', value: 0 });
  return { recorded, playback, pos, status: document.querySelector('#status').textContent };
});

await page.screenshot({ path: 'C:/Users/BigBoof/.gemini/antigravity/scratch/opvyn/wasm/shots/02-transport.png' });
console.log(JSON.stringify({ keyOn, res, errors }, null, 1));
await browser.close();


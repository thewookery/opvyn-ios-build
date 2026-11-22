import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:8790/', { waitUntil: 'networkidle0' });
await page.click('#start');
await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Hz'), { timeout: 20000 });

const result = await page.evaluate(async () => {
  const o = window.__opvyn;
  await o.ctx.resume();
  const measure = async () => {
    await new Promise((r) => setTimeout(r, 420));
    const b = new Float32Array(o.analyser.fftSize);
    o.analyser.getFloatTimeDomainData(b);
    let p = 0;
    for (const v of b) p = Math.max(p, Math.abs(v));
    return +p.toFixed(3);
  };
  const engines = [];
  for (let i = 0; i < 15; i++) {
    o.post({ type: 'fx', value: 0, mix: 0 });
    o.post({ type: 'engine', value: i });
    o.post({ type: 'allOff' });
    await new Promise((r) => setTimeout(r, 120));
    o.post({ type: 'noteOn', note: 60, velocity: 0.9 });
    const peak = await measure();
    o.post({ type: 'noteOff', note: 60 });
    engines.push({ i, peak });
    await new Promise((r) => setTimeout(r, 60));
  }
  const fxs = [];
  o.post({ type: 'engine', value: 2 });
  for (let i = 1; i < 11; i++) {
    o.post({ type: 'fx', value: i, mix: 0.6 });
    await new Promise((r) => setTimeout(r, 80));
    o.post({ type: 'noteOn', note: 64, velocity: 0.9 });
    const peak = await measure();
    o.post({ type: 'noteOff', note: 64 });
    fxs.push({ i, peak });
    await new Promise((r) => setTimeout(r, 80));
  }
  o.post({ type: 'fx', value: 0, mix: 0 });
  return { engines, fxs };
});
console.log(JSON.stringify({ ...result, errors }, null, 1));
await browser.close();

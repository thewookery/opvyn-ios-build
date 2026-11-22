import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const errors = [];
for (const [w, h, name] of [[390, 844, 'iphone14'], [375, 667, 'iphoneSE']]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8790/', { waitUntil: 'networkidle0' });
  await page.click('#start');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Hz'), { timeout: 20000 });
  await page.evaluate(async () => {
    const o = window.__opvyn;
    o.post({ type: 'engine', value: 5 });
    o.post({ type: 'noteOn', note: 60, velocity: 0.9 });
    o.post({ type: 'noteOn', note: 67, velocity: 0.9 });
  });
  await new Promise((r) => setTimeout(r, 600));
  const info = await page.evaluate(() => {
    const a = window.__opvyn.analyser;
    const b = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(b);
    let p = 0; for (const v of b) p = Math.max(p, Math.abs(v));
    return { peak: +p.toFixed(3), scrollH: document.body.scrollHeight, innerH: window.innerHeight };
  });
  await page.screenshot({ path: `C:/Users/BigBoof/.gemini/antigravity/scratch/opvyn/wasm/shots/${name}.png` });
  console.log(name, JSON.stringify(info));
  await page.close();
}
console.log('errors', JSON.stringify(errors));
await browser.close();

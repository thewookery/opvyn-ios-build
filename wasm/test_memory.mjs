import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:8790/', { waitUntil: 'networkidle0' });
await page.click('#start');
await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Hz'), { timeout: 20000 });

const out = await page.evaluate(async () => {
  const o = window.__opvyn;
  const mem = [];
  let lastMB = 0;
  const orig = o.node.port.onmessage;
  o.node.port.onmessage = (e) => { if (e.data.memMB) lastMB = e.data.memMB; orig(e); };
  o.post({ type: 'engine', value: 2 });
  for (let t = 0; t < 4; t++) {
    o.post({ type: 'select_track', value: t });
    o.post({ type: 'seek', value: 0 });
    o.post({ type: 'record', value: 1 });
    o.post({ type: 'play', value: 1 });
    o.post({ type: 'noteOn', note: 55 + t });
    await new Promise((r) => setTimeout(r, 700));
    o.post({ type: 'noteOff', note: 55 + t });
    o.post({ type: 'record', value: 0 });
    o.post({ type: 'play', value: 0 });
    await new Promise((r) => setTimeout(r, 500));
    mem.push(lastMB);
  }
  return { mem };
});
await new Promise((r) => setTimeout(r, 600));
console.log(JSON.stringify({ out, errors }, null, 1));
await browser.close();

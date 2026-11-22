import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8790/';
fs.mkdirSync('C:/Users/BigBoof/.gemini/antigravity/scratch/opvyn/wasm/shots', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.click('#start');
await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Hz'), { timeout: 20000 }).catch(() => {});

const status = await page.$eval('#status', (e) => e.textContent);
await page.evaluate(async () => {
  const o = window.__opvyn;
  await o.ctx.resume();
  o.post({ type: 'engine', value: 2 });
  o.post({ type: 'noteOn', note: 60, velocity: 0.9 });
  o.post({ type: 'noteOn', note: 64, velocity: 0.9 });
  o.post({ type: 'noteOn', note: 67, velocity: 0.9 });
});
await new Promise((r) => setTimeout(r, 700));
const audio = await page.evaluate(() => {
  const a = window.__opvyn.analyser;
  const b = new Float32Array(a.fftSize);
  a.getFloatTimeDomainData(b);
  let p = 0, s = 0;
  for (const v of b) { p = Math.max(p, Math.abs(v)); s += v * v; }
  return { peak: p, rms: Math.sqrt(s / b.length), state: window.__opvyn.ctx.state };
});
await new Promise((r) => setTimeout(r, 500));
const voices = await page.$eval('#voiceCount', (e) => e.textContent);
await page.screenshot({ path: 'C:/Users/BigBoof/.gemini/antigravity/scratch/opvyn/wasm/shots/01-play.png' });

console.log(JSON.stringify({ status, audio, voices, errors }, null, 1));
await browser.close();

// Renders a short OPVYN engine performance to WAV using the wasm build.
// Node 18+: node wasm/render.mjs
import fs from 'node:fs';

const path = new URL('../build-wasm/opvyn.wasm', import.meta.url);
const bytes = fs.readFileSync(path);
const module = await WebAssembly.compile(bytes);

// Minimal WASI shim: the engine does not do file or clock I/O on the audio path.
const procExit = (code) => { throw new Error('proc_exit ' + code); };
const wasi = new Proxy({ proc_exit: procExit }, {
  get(t, k) {
    if (k in t) return t[k];
    return (...args) => 0;
  },
});

const instance = await WebAssembly.instantiate(module, { env: { emscripten_notify_memory_growth: () => {} }, wasi_snapshot_preview1: wasi });
const e = instance.exports;
if (e._initialize) e._initialize();
const mem = () => new Float32Array(e.memory.buffer);

const SR = 48000, BLOCK = 128, SECONDS = 4;
const frames = SR * SECONDS;

e.opvyn_prepare(SR, BLOCK);
e.opvyn_set_engine(0);
e.opvyn_set_engine_macros(0.35, 0.5, 0.45, 0.3);
e.opvyn_set_adsr(0.01, 0.2, 0.7, 0.25);
e.opvyn_set_volume(0.65);
e.opvyn_set_fx(0, 0.2);

const lp = e.malloc(BLOCK * 4);
const rp = e.malloc(BLOCK * 4);
const outL = new Float32Array(frames);
const outR = new Float32Array(frames);

const notes = [60, 64, 67];
for (const n of notes) e.opvyn_note_on(n, 0.9);

let peak = 0;
for (let pos = 0; pos < frames; pos += BLOCK) {
  const n = Math.min(BLOCK, frames - pos);
  e.opvyn_process(lp, rp, n);
  const L = new Float32Array(e.memory.buffer, lp, n);
  const R = new Float32Array(e.memory.buffer, rp, n);
  for (let i = 0; i < n; i++) {
    outL[pos + i] = L[i];
    outR[pos + i] = R[i];
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
}

console.log('peak', peak.toFixed(4), 'voices', e.opvyn_active_voices());

// 16-bit stereo WAV
const n = frames, buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(outL[i] * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(outR[i] * 32767))), 46 + i * 4);
}
fs.writeFileSync(new URL('../build-wasm/opvyn-test.wav', import.meta.url), buf);
console.log('wrote build-wasm/opvyn-test.wav');

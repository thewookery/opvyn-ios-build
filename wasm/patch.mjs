import fs from 'node:fs';
const src = fs.readFileSync('wasm/render.mjs','utf8')
  .replace("const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi });",
           "const instance = await WebAssembly.instantiate(module, { env: { emscripten_notify_memory_growth: () => {} }, wasi_snapshot_preview1: wasi });")
  .replace(/e\._opvyn_/g, 'e.opvyn_')
  .replace("e._malloc", "e.malloc")
  .replace("e._free", "e.free");
fs.writeFileSync('wasm/render.mjs', src);
console.log('patched');

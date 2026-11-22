/* OPVYN engine AudioWorklet — loads the standalone wasm and renders it. */
class OpvynProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ready = false;
    this.queue = [];
    this.maxBlock = 512;
    this.port.onmessage = (e) => this.handle(e.data);
    this.init(options.processorOptions || {});
  }

  async init(opts) {
    const stub = new Proxy(
      { proc_exit: (c) => { throw new Error('wasm exit ' + c); } },
      { get: (t, k) => (k in t ? t[k] : () => 0) }
    );
    try {
      const { instance } = await WebAssembly.instantiate(opts.wasm, {
        env: { emscripten_notify_memory_growth: () => {} },
        wasi_snapshot_preview1: stub,
      });
      const e = instance.exports;
      if (e._initialize) e._initialize();
      this.e = e;
      this.mem = e.memory;
      this.lp = e.malloc(this.maxBlock * 4);
      this.rp = e.malloc(this.maxBlock * 4);
      const sr = opts.sampleRate || 48000;
      e.opvyn_prepare(sr, this.maxBlock);
      this.ready = true;
      this.port.postMessage({ type: 'ready', sampleRate: sr });
      for (const m of this.queue) this.apply(m);
      this.queue = [];
    } catch (err) {
      this.port.postMessage({ type: 'error', message: String(err && err.message || err) });
    }
  }

  handle(m) {
    if (!this.ready) { this.queue.push(m); return; }
    this.apply(m);
  }

  apply(m) {
    const e = this.e;
    switch (m.type) {
      case 'engine': e.opvyn_set_engine(m.value | 0); break;
      case 'macros': e.opvyn_set_engine_macros(m.a, m.b, m.c, m.d); break;
      case 'adsr': e.opvyn_set_adsr(m.a, m.d, m.s, m.r); break;
      case 'fx': e.opvyn_set_fx(m.value | 0, m.mix); break;
      case 'volume': e.opvyn_set_volume(m.value); break;
      case 'drum': e.opvyn_set_drum_mode(m.value ? 1 : 0); break;
      case 'tempo': e.opvyn_set_tempo(m.value); break;
      case 'noteOn': e.opvyn_note_on(m.note | 0, m.velocity ?? 0.8); break;
      case 'noteOff': e.opvyn_note_off(m.note | 0); break;
      case 'allOff': e.opvyn_all_notes_off(); break;
      case 'play': e.opvyn_play(m.value ? 1 : 0); break;
      case 'record': e.opvyn_record(m.value ? 1 : 0); break;
      case 'seek': e.opvyn_seek(m.value); break;
      case 'select_track': e.opvyn_select_track(m.value | 0); break;
      case 'clear_track': e.opvyn_clear_track(); break;
      case 'loop': e.opvyn_set_loop(m.value ? 1 : 0, m.a, m.b); break;
      case 'query':
        this.port.postMessage({
          type: 'status',
          voices: e.opvyn_active_voices(),
          position: e.opvyn_position(),
          recording: e.opvyn_recording() ? 1 : 0,
          peaks: [0, 1, 2, 3].map((i) => e.opvyn_track_peak(i)),
          memMB: +(this.mem.buffer.byteLength / 1048576).toFixed(1),
        });
        break;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const n = L.length;
    if (!this.ready) { L.fill(0); R.fill(0); return true; }
    if (n > this.maxBlock) { L.fill(0); R.fill(0); return true; }
    this.e.opvyn_process(this.lp, this.rp, n);
    const fl = new Float32Array(this.mem.buffer, this.lp, n);
    const fr = new Float32Array(this.mem.buffer, this.rp, n);
    for (let i = 0; i < n; i++) { L[i] = fl[i]; R[i] = fr[i]; }
    return true;
  }
}
registerProcessor('opvyn', OpvynProcessor);

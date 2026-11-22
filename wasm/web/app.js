/* OPVYN wasm — touch UI for the OPVYN engine running in an AudioWorklet. */
const ENGINES = ['VOLTAGE', 'FM', 'CLUSTER', 'DIGITAL', 'DR WAVE', 'DIMENSION', 'STRING', 'PULSE', 'PHASE', 'DNA', 'DSYNTH', 'SAMPLER', 'VOCODER', 'AMP', 'DBOX'];
const EFFECTS = ['OFF', 'DELAY', 'SPRING', 'GRID', 'NITRO', 'PHONE', 'PUNCH', 'CWO', 'TERMINAL', 'MOTHER', 'FAZER'];

const state = {
  engine: 0,
  macros: [0.35, 0.5, 0.45, 0.3],
  adsr: [0.01, 0.2, 0.7, 0.25],
  fx: 0,
  mix: 0.25,
  octave: 0,
  noteOffset: 0,
  track: 0,
  playing: false,
  recording: false,
  loop: false,
  drum: false,
};

let ctx, node, analyser, wasmBytes, started = false;
let lastPos = 0;
const held = new Set();

const $ = (s) => document.querySelector(s);

function post(m) { if (node) node.port.postMessage(m); }

function sendMacros() {
  post({ type: 'macros', a: state.macros[0], b: state.macros[1], c: state.macros[2], d: state.macros[3] });
}
function sendAdsr() {
  post({ type: 'adsr', a: state.adsr[0], d: state.adsr[1], s: state.adsr[2], r: state.adsr[3] });
}

/* ---------- chips ---------- */
function buildChips(host, names, onPick, isOn) {
  host.innerHTML = '';
  names.forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => { onPick(i); paint(); };
    host.appendChild(b);
  });
  function paint() {
    [...host.children].forEach((b, i) => b.classList.toggle('on', isOn(i)));
  }
  paint();
  host._paint = paint;
  return paint;
}

/* ---------- knobs ---------- */
function buildKnobs() {
  const host = $('#knobs');
  host.innerHTML = '';
  const colors = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--red)'];
  const labels = ['BLUE', 'OCHRE', 'GREY', 'ORANGE'];
  state.macros.forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'knob';
    d.innerHTML = `<div class="dial"></div><div class="lbl">${labels[i]}</div><div class="val">${Math.round(v * 100)}</div>`;
    host.appendChild(d);
    const dial = d.querySelector('.dial');
    const val = d.querySelector('.val');
    const paint = () => {
      dial.style.setProperty('--a', `${-135 + state.macros[i] * 270}deg`);
      dial.style.setProperty('--c', colors[i]);
      val.textContent = Math.round(state.macros[i] * 100);
    };
    paint();
    let startY = 0, startV = 0, drag = false;
    d.addEventListener('pointerdown', (e) => {
      e.preventDefault(); drag = true; startY = e.clientY; startV = state.macros[i];
      d.setPointerCapture(e.pointerId); d.classList.add('drag');
    });
    d.addEventListener('pointermove', (e) => {
      if (!drag) return;
      state.macros[i] = Math.max(0, Math.min(1, startV + (startY - e.clientY) / 160));
      paint(); sendMacros();
    });
    const end = () => { drag = false; d.classList.remove('drag'); };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);
  });
}

/* ---------- env ---------- */
function buildEnv() {
  const host = $('#env');
  host.innerHTML = '';
  ['ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE'].forEach((name, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const max = i === 2 ? 1 : 2;
    cell.innerHTML = `<label>${name}</label><input type="range" min="0" max="${max}" step="0.01" value="${state.adsr[i]}">`;
    host.appendChild(cell);
    cell.querySelector('input').addEventListener('input', (e) => {
      state.adsr[i] = parseFloat(e.target.value);
      sendAdsr();
    });
  });
}

/* ---------- keyboard ---------- */
const BLACK = new Set([1, 3, 6, 8, 10]);
function buildKeyboard() {
  const el = $('#keyboard');
  el.innerHTML = '<div class="kb"><div class="kb-white"></div><div class="kb-black"></div></div>';
  const white = el.querySelector('.kb-white');
  const black = el.querySelector('.kb-black');
  const whites = [];
  for (let s = 0; s < 24; s++) if (!BLACK.has(s % 12)) whites.push(s);
  for (const s of whites) {
    const k = document.createElement('div');
    k.className = 'key white'; k.dataset.semi = s;
    white.appendChild(k);
  }
  for (const s of whites) {
    const next = s + 1;
    if (BLACK.has(next % 12)) {
      const k = document.createElement('div');
      k.className = 'key black'; k.dataset.semi = next;
      k.style.left = `calc(${((whites.indexOf(s) + 1) / whites.length) * 100}% - var(--bw) / 2)`;
      black.appendChild(k);
    }
  }
  const noteFor = (semi) => 48 + state.octave * 12 + semi;
  el.addEventListener('pointerdown', (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t || !t.classList.contains('key')) return;
    e.preventDefault();
    const note = noteFor(Number(t.dataset.semi));
    t.classList.add('on');
    held.add(note);
    post({ type: 'noteOn', note, velocity: 0.85 });
  });
  const releaseAt = (x, y) => {
    const t = document.elementFromPoint(x, y);
    if (t && t.classList.contains('key')) {
      const note = noteFor(Number(t.dataset.semi));
      t.classList.remove('on');
      if (held.has(note)) { held.delete(note); post({ type: 'noteOff', note }); }
    }
  };
  el.addEventListener('pointerup', (e) => releaseAt(e.clientX, e.clientY));
  el.addEventListener('pointercancel', (e) => releaseAt(e.clientX, e.clientY));
  el.addEventListener('pointerleave', (e) => releaseAt(e.clientX, e.clientY));
}

/* ---------- scope ---------- */
function drawScope() {
  const c = $('#scope');
  const g = c.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#131b23'; g.beginPath();
  g.moveTo(0, c.height / 2); g.lineTo(c.width, c.height / 2); g.stroke();
  if (analyser) {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    g.strokeStyle = '#3ddc84'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < buf.length; i += 2) {
      const x = (i / buf.length) * c.width;
      const y = c.height / 2 - buf[i] * c.height * 0.42;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  requestAnimationFrame(drawScope);
}

/* ---------- boot ---------- */
let fallback = null;

function applyStatus(d) {
  if (d.voices != null) $('#voiceCount').textContent = `${d.voices} voices`;
  const t = d.position || 0;
  lastPos = t;
  const m = Math.floor(t / 60), s = Math.floor(t % 60), tenth = Math.floor((t % 1) * 10);
  $('#pos').textContent = `${m}:${String(s).padStart(2, '0')}.${tenth}`;
  document.querySelectorAll('#tracks button[data-t]').forEach((b, i) => {
    b.querySelector('.meter').style.width = `${Math.min(100, (d.peaks[i] || 0) * 100)}%`;
  });
}

async function instantiateWasm(bytes) {
  const stub = new Proxy(
    { proc_exit: () => { throw new Error('wasm exit'); } },
    { get: (t, k) => (k in t ? t[k] : () => 0) }
  );
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: { emscripten_notify_memory_growth: () => {} },
    wasi_snapshot_preview1: stub,
  });
  const e = instance.exports;
  if (e._initialize) e._initialize();
  return e;
}

function fallbackApply(m) {
  const e = fallback.e;
  switch (m.type) {
    case 'engine': e.opvyn_set_engine(m.value | 0); break;
    case 'macros': e.opvyn_set_engine_macros(m.a, m.b, m.c, m.d); break;
    case 'adsr': e.opvyn_set_adsr(m.a, m.d, m.s, m.r); break;
    case 'fx': e.opvyn_set_fx(m.value | 0, m.mix); break;
    case 'volume': e.opvyn_set_volume(m.value); break;
    case 'drum': e.opvyn_set_drum_mode(m.value ? 1 : 0); break;
    case 'noteOn': e.opvyn_note_on(m.note | 0, m.velocity ?? 0.8); break;
    case 'noteOff': e.opvyn_note_off(m.note | 0); break;
    case 'allOff': e.opvyn_all_notes_off(); break;
    case 'play': e.opvyn_play(m.value ? 1 : 0); break;
    case 'record': e.opvyn_record(m.value ? 1 : 0); break;
    case 'seek': e.opvyn_seek(m.value); break;
    case 'select_track': e.opvyn_select_track(m.value | 0); break;
    case 'clear_track': e.opvyn_clear_track(); break;
    case 'loop': e.opvyn_set_loop(m.value ? 1 : 0, m.a, m.b); break;
  }
}

async function startFallback() {
  const e = await instantiateWasm(wasmBytes);
  const maxBlock = 2048;
  const lp = e.malloc(maxBlock * 4);
  const rp = e.malloc(maxBlock * 4);
  e.opvyn_prepare(ctx.sampleRate, maxBlock);
  const sp = ctx.createScriptProcessor ? ctx.createScriptProcessor(maxBlock, 1, 2) : ctx.createJavaScriptNode(maxBlock, 1, 2);
  // A silent input keeps the ScriptProcessor pulling on engines that skip zero-input nodes.
  const silent = ctx.createConstantSource ? ctx.createConstantSource() : null;
  if (silent) { silent.offset.value = 0; silent.connect(sp); silent.start(); }
  sp.onaudioprocess = (ev) => {
    const n = ev.outputBuffer.length;
    e.opvyn_process(lp, rp, n);
    const L = new Float32Array(e.memory.buffer, lp, n);
    const R = new Float32Array(e.memory.buffer, rp, n);
    ev.outputBuffer.getChannelData(0).set(L);
    ev.outputBuffer.getChannelData(1).set(R);
  };
  sp.connect(analyser);
  fallback = { e, lp, rp, maxBlock, sp };
  node = { port: { postMessage: (m) => fallbackApply(m) } };
  $('#status').textContent = `${ctx.sampleRate | 0} Hz · compat`;
  setInterval(() => applyStatus({
    voices: e.opvyn_active_voices(),
    position: e.opvyn_position(),
    peaks: [0, 1, 2, 3].map((i) => e.opvyn_track_peak(i)),
  }), 250);
}

async function start() {
  $('#start').disabled = true;
  $('#status').textContent = 'fetching engine…';
  wasmBytes = await (await fetch('opvyn.wasm')).arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.connect(ctx.destination);

  let useWorklet = false;
  if (ctx.audioWorklet) {
    try {
      await ctx.audioWorklet.addModule('opvyn-worklet.js');
      node = new AudioWorkletNode(ctx, 'opvyn', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { wasm: wasmBytes, sampleRate: ctx.sampleRate },
      });
      node.connect(analyser);
      node.port.onmessage = (e) => {
        const d = e.data;
        if (d.type === 'ready') $('#status').textContent = `${d.sampleRate | 0} Hz · wasm`;
        else if (d.type === 'error') $('#status').textContent = 'error: ' + d.message;
        else if (d.type === 'status') applyStatus(d);
      };
      useWorklet = true;
    } catch (err) {
      console.warn('AudioWorklet unavailable, using compatibility mode', err);
    }
  }

  await ctx.resume();
  if (useWorklet) {
    setInterval(() => node.port.postMessage({ type: 'query' }), 250);
  } else {
    $('#status').textContent = 'starting compatibility mode…';
    await startFallback();
  }

  post({ type: 'engine', value: state.engine });
  sendMacros(); sendAdsr();
  post({ type: 'fx', value: state.fx, mix: state.mix });
  post({ type: 'volume', value: 0.72 });
  post({ type: 'select_track', value: 0 });
  post({ type: 'loop', value: 0, a: 0, b: 8 });

  started = true;
  $('#overlay').classList.add('gone');
  drawScope();
}

/* ---------- wiring ---------- */
function init() {
  buildChips($('#engineRow'), ENGINES, (i) => {
    state.engine = i;
    post({ type: 'engine', value: i });
  }, (i) => i === state.engine);
  buildKnobs();
  buildEnv();
  buildKeyboard();
  buildChips($('#fxChips'), EFFECTS, (i) => {
    state.fx = i;
    post({ type: 'fx', value: i, mix: state.mix });
  }, (i) => i === state.fx);

  // transport
  const setPlay = (on) => {
    state.playing = on;
    post({ type: 'play', value: on ? 1 : 0 });
    $('#play').classList.toggle('on', on);
    if (!on) { state.recording = false; $('#rec').classList.remove('on'); }
  };
  $('#play').addEventListener('click', () => setPlay(!state.playing));
  $('#stop').addEventListener('click', () => { setPlay(false); post({ type: 'record', value: 0 }); });
  $('#rec').addEventListener('click', () => {
    state.recording = !state.recording;
    if (state.recording && !state.playing) setPlay(true);
    post({ type: 'record', value: state.recording ? 1 : 0 });
    $('#rec').classList.toggle('on', state.recording);
  });
  $('#rew').addEventListener('click', () => post({ type: 'seek', value: Math.max(0, lastPos - 2) }));
  $('#ff').addEventListener('click', () => post({ type: 'seek', value: lastPos + 2 }));
  $('#loop').addEventListener('click', () => {
    state.loop = !state.loop;
    $('#loop').classList.toggle('on', state.loop);
    post({ type: 'loop', value: state.loop ? 1 : 0, a: 0, b: 8 });
  });

  document.querySelectorAll('#tracks button[data-t]').forEach((b, i) => {
    const meter = document.createElement('div');
    meter.className = 'meter';
    b.appendChild(meter);
    b.addEventListener('click', () => {
      state.track = i;
      post({ type: 'select_track', value: i });
      document.querySelectorAll('#tracks button[data-t]').forEach((x, j) => x.classList.toggle('sel', j === i));
    });
  });
  document.querySelector('#tracks button[data-t="0"]').classList.add('sel');

  $('#drum').addEventListener('click', () => {
    state.drum = !state.drum;
    post({ type: 'drum', value: state.drum ? 1 : 0 });
    $('#drum').classList.toggle('on', state.drum);
    if (state.drum) {
      state.engine = 14;
      post({ type: 'engine', value: 14 });
      $('#engineRow')._paint();
    }
  });
  $('#mix').addEventListener('input', (e) => {
    state.mix = parseFloat(e.target.value);
    post({ type: 'fx', value: state.fx, mix: state.mix });
  });
  $('#panic').addEventListener('click', () => {
    held.clear();
    document.querySelectorAll('.key.on').forEach((k) => k.classList.remove('on'));
    post({ type: 'allOff' });
  });
  $('#start').addEventListener('click', () => {
    $('#ovErr').textContent = '';
    start().catch((err) => {
      console.error(err);
      $('#status').textContent = 'failed: ' + err.message;
      $('#ovErr').textContent = 'Could not start the engine:\n' + (err && err.message ? err.message : err) +
        '\n\nCheck that the page is served from the OPVYN server (not opened as a file) and that opvyn.wasm is reachable.';
      $('#start').disabled = false;
    });
  });
}

init();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.__opvyn = {
  state, post,
  get ctx() { return ctx; },
  get node() { return node; },
  get analyser() { return analyser; },
};

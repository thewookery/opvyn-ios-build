// OPVYN engine C API for WebAssembly.
// The engine core (Source/Engine.*, TapeAudio, TapeStorage) is JUCE-free, so it
// compiles to wasm as-is. This wrapper exposes just enough to drive it from an
// AudioWorklet.
#include "Engine.h"
#include <emscripten/emscripten.h>
#include <algorithm>
#include <cstring>

using field::Engine;
using field::Parameters;

static Engine* g = nullptr;
static Parameters P;

static void push() {
    if (g) g->setParameters(P);
}

extern "C" {

EMSCRIPTEN_KEEPALIVE void opvyn_create() {
    if (!g) {
        g = new Engine();
        P = Parameters{};
        g->setParameters(P);
    }
}

EMSCRIPTEN_KEEPALIVE void opvyn_prepare(float sampleRate, int maxBlock) {
    opvyn_create();
    g->prepare(sampleRate, maxBlock);
}

EMSCRIPTEN_KEEPALIVE void opvyn_set_engine(int e) { P.engine = e; push(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_macro(int i, float v) {
    if (i >= 0 && i < 4) { P.macro[i] = v; push(); }
}
EMSCRIPTEN_KEEPALIVE void opvyn_set_adsr(float a, float d, float s, float r) {
    P.attack = a; P.decay = d; P.sustain = s; P.release = r; push();
}
EMSCRIPTEN_KEEPALIVE void opvyn_set_fx(int type, float mix) { P.effect = type; P.effectMix = mix; push(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_volume(float v) { P.volume = v; push(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_drum_mode(int on) { P.drumMode = on != 0; push(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_tempo(float bpm) { P.tempo = bpm; push(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_engine_macros(float a, float b, float c, float d) {
    P.macro[0] = a; P.macro[1] = b; P.macro[2] = c; P.macro[3] = d; push();
}

EMSCRIPTEN_KEEPALIVE void opvyn_note_on(int note, float velocity) { if (g) g->noteOn(note, velocity); }
EMSCRIPTEN_KEEPALIVE void opvyn_note_off(int note) { if (g) g->noteOff(note); }
EMSCRIPTEN_KEEPALIVE void opvyn_all_notes_off() { if (g) g->allNotesOff(); }
EMSCRIPTEN_KEEPALIVE int opvyn_active_voices() { return g ? g->activeVoiceCount() : 0; }
EMSCRIPTEN_KEEPALIVE void opvyn_process(float* left, float* right, int frames) {
    if (g) g->process(left, right, nullptr, nullptr, frames);
}

EMSCRIPTEN_KEEPALIVE float opvyn_pitch() { return g ? g->currentVoicePitch() : 0.f; }

// tape transport
EMSCRIPTEN_KEEPALIVE void opvyn_play(int on) { if (g) g->setPlaying(on != 0); }
EMSCRIPTEN_KEEPALIVE void opvyn_record(int on) { if (g) g->setRecording(on != 0); }
EMSCRIPTEN_KEEPALIVE void opvyn_seek(double seconds) { if (g) g->seek(seconds); }
EMSCRIPTEN_KEEPALIVE double opvyn_position() { return g ? g->positionSeconds() : 0.0; }
EMSCRIPTEN_KEEPALIVE int opvyn_recording() { return (g && g->recording()) ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE void opvyn_select_track(int i) { if (g) g->selectTrack(i); }
EMSCRIPTEN_KEEPALIVE float opvyn_track_peak(int i) { return g ? g->trackPeaks[(size_t)std::clamp(i, 0, 3)] : 0.f; }
EMSCRIPTEN_KEEPALIVE void opvyn_clear_track() { if (g) g->clearTrack(); }
EMSCRIPTEN_KEEPALIVE void opvyn_set_loop(int on, double a, double b) {
    if (g) { P.loop = on != 0; push(); g->setLoop(a, b); }
}

} // extern "C"

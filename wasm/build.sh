#!/usr/bin/env bash
# Build the OPVYN engine core to a standalone WebAssembly module.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p build-wasm

EXPORTS='["_malloc","_free","_opvyn_create","_opvyn_prepare","_opvyn_set_engine","_opvyn_set_macro","_opvyn_set_engine_macros","_opvyn_set_adsr","_opvyn_set_fx","_opvyn_set_volume","_opvyn_set_drum_mode","_opvyn_set_tempo","_opvyn_note_on","_opvyn_note_off","_opvyn_all_notes_off","_opvyn_active_voices","_opvyn_process","_opvyn_pitch","_opvyn_play","_opvyn_record","_opvyn_seek","_opvyn_position","_opvyn_recording","_opvyn_select_track","_opvyn_track_peak","_opvyn_clear_track","_opvyn_set_loop"]'

emcc -O3 -std=c++17 \
  -I Source \
  wasm/opvyn_wasm.cpp \
  Source/Engine.cpp Source/EngineDocument.cpp Source/TapeAudio.cpp Source/TapeStorage.cpp \
  -s STANDALONE_WASM=1 \
  --no-entry \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s MAXIMUM_MEMORY=536870912 \
  -s EXPORTED_FUNCTIONS="$EXPORTS" \
  -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
  -o build-wasm/opvyn.wasm

ls -l build-wasm/opvyn.wasm
cp build-wasm/opvyn.wasm wasm/web/opvyn.wasm
echo "copied to wasm/web/opvyn.wasm"

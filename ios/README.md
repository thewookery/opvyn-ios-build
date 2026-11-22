# OPVYN on iPhone — the original panel

The VST's graphics are **not images**; they are drawn in `Source/PluginEditor.cpp` with JUCE. They only exist when that C++ is compiled with JUCE, so they cannot appear in the WebAssembly build. To see the real panel on an iPhone you have to build the JUCE editor for iOS. That is what this folder does.

No UI code was rewritten: `paint()`, the LCDs, fonts, colours and layout are the originals. The only iOS-specific change is that the editor takes the screen size instead of forcing a 1320×640 window (`setSize` in the constructor, guarded by `JUCE_IOS`); the existing responsive `scale`/`hardware` layout does the rest. The panel is the same 1280×480 artwork, scaled to fit.

## Build

You need macOS with Xcode 15+ (or a GitHub Actions macOS runner).

```bash
./ios/build_ios.sh
```

It produces `OPVYN-unsigned.ipa`.

What it does:

1. `cmake -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DFIELD_IOS=ON` — the CMake option added for this port selects `Standalone AUv3` instead of `Standalone VST3 AU`.
2. Builds the `FieldStudio_Standalone` app for arm64 / iOS 16.
3. Injects `UIBackgroundModes=audio`, landscape orientations and full-screen flags into the app's `Info.plist`.
4. Packages `Payload/OPVYN.app` as an unsigned `.ipa`.

## Build in the cloud

Push this repo to GitHub and run **Actions → iOS unsigned build → Run workflow**. The `.ipa` is uploaded as an artifact. No Mac required for the build itself.

## Install on the iPhone

The IPA is unsigned. Sign it with your own Apple ID using one of:

* **SideStore / AltStore** (free account, 7-day resign; automatic refresh with a pairing file),
* **TrollStore** (permanent, devices with a CoreTrust bug),
* **Xcode** if you have a Mac: open the generated project in `build-ios/`, set your team, Run.

The app is landscape. On an iPhone it renders the full panel scaled down (~0.55× on a 6.1" phone, ~0.78× on an iPad); on an iPad the panel is close to native size. Text is small on a phone by design — it is the real VST layout, not a mobile redesign.

## Why not the wasm build?

JUCE has no WebAssembly GUI backend. `wasm/` runs the *same engine* in Safari with a purpose-built touch shell — it works on iPhone today, but its graphics are not OPVYN's. This `ios/` build is the one that has the original graphics.

## Status

* Build scripts and the `FIELD_IOS` CMake path are written but **cannot be compiled on Windows**; the first run needs a Mac or the Actions workflow.
* If the standalone target name differs in your JUCE version, check `cmake --build build-ios --target help` and adjust `FieldStudio_Standalone`.
* The AUv3 target is built too and can be hosted in AUM/GarageBand on iPhone/iPad.

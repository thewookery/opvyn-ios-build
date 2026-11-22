#!/usr/bin/env bash
# Build the real OPVYN JUCE panel as an iOS app (unsigned .ipa).
# Requires macOS + Xcode 15+ (or run via .github/workflows/ios.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD=build-ios
rm -rf "$BUILD" Payload OPVYN-unsigned.ipa

cmake -B "$BUILD" -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0 \
  -DFIELD_IOS=ON \
  -DFIELD_BUILD_PLUGIN=ON \
  -DBUILD_TESTING=OFF

cmake --build "$BUILD" --config Release --target FieldStudio_Standalone -- \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO

APP="$(find "$BUILD" -name '*.app' -type d -path '*Release-iphoneos*' | head -1)"
[ -n "$APP" ] || { echo "no .app produced" >&2; exit 1; }
echo "app: $APP"

PLIST="$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"

/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationLandscapeLeft" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:1 string UIInterfaceOrientationLandscapeRight" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UIRequiresFullScreen bool true" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIStatusBarHidden bool true" "$PLIST" >/dev/null 2>&1 || true

mkdir -p Payload
cp -R "$APP" Payload/
zip -qry OPVYN-unsigned.ipa Payload
rm -rf Payload

echo "wrote $(pwd)/OPVYN-unsigned.ipa"

#!/usr/bin/env bash
# Build the OPVYN iOS app for the simulator and capture a screenshot of the real panel.
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD=build-sim
rm -rf "$BUILD" sim-shot.png

cmake -B "$BUILD" -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0 \
  -DFIELD_IOS=ON \
  -DFIELD_BUILD_PLUGIN=ON \
  -DBUILD_TESTING=OFF

cmake --build "$BUILD" --config Release --target FieldStudio_Standalone -- \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO

APP="$(find "$BUILD" -name 'OPVYN.app' -type d | head -1)"
[ -n "$APP" ] || { echo "no .app produced" >&2; exit 1; }
echo "app: $APP"

# Same plist treatment as the device build, so the simulator launches landscape.
PLIST="$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationLandscapeLeft" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:1 string UIInterfaceOrientationLandscapeRight" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :UIRequiresFullScreen true" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :UIRequiresFullScreen bool true" "$PLIST"

UDID="$(xcrun simctl list devices available | grep -E '^\s+iPhone' | head -1 | grep -oE '[0-9A-F-]{36}' | head -1)"
[ -n "$UDID" ] || { echo "no iPhone simulator found" >&2; xcrun simctl list devices available; exit 1; }
echo "simulator: $UDID"

xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" studio.field.instrument || true
sleep 8
xcrun simctl io "$UDID" screenshot sim-shot.png
ls -l sim-shot.png

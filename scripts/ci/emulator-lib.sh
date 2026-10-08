# Helpers the emulator check scripts source; not a script on its own.
# shellcheck shell=bash

readonly APP_ID="dev.nedaa.android"
# Mecca, as longitude then latitude, the order `geo fix` takes.
readonly GEO_FIX=(39.8262 21.4225)

step() { echo "::group::$1"; }
fail() {
  echo "::error::$1"
  exit 1
}

logcat_pids=()
trap 'kill "${logcat_pids[@]}" 2>/dev/null || true' EXIT

# Writes the whole device log to <out>/logcat.txt.
start_device_log() {
  adb wait-for-device
  # The default ring buffer drops lines over a long run.
  adb logcat -G 16M
  adb logcat -c
  adb logcat -v threadtime >"$1/logcat.txt" 2>&1 &
  logcat_pids+=($!)
}

# Installs <apk> fresh with its permissions; logs the app to <out>.
install_fresh() {
  local apk="$1" out="$2" app_uid
  # Location off makes Play services prompt over the app; on, the fix is used.
  adb shell cmd location set-location-enabled true
  adb emu geo fix "${GEO_FIX[@]}"
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb install -g "$apk"
  app_uid="$(adb shell cmd package list packages -U "$APP_ID" | sed -n 's/.*uid:\([0-9]*\).*/\1/p' | tr -d '\r')"
  [ -n "$app_uid" ] || fail "$APP_ID is not installed"
  # Every process the app starts shares its uid, so restarts stay in this log.
  adb logcat -v threadtime --uid="$app_uid" >"$out/logcat-app.txt" 2>&1 &
  logcat_pids+=($!)
}

# A loaded runner can drop the emulator off adb; reconnect before failing.
ensure_device() {
  adb reconnect offline >/dev/null 2>&1 || true
  timeout 90 adb wait-for-device || fail "The emulator went offline (runner fault, not the app)"
}

#!/usr/bin/env bash
# Checks a release APK on the booted emulator: onboarding, alarms, top screens.
# MAESTRO overrides the maestro binary.
set -euo pipefail

readonly APP_ID="dev.nedaa.android"
# Mecca, as longitude then latitude, the order `geo fix` takes.
readonly GEO_FIX=(39.8262 21.4225)
readonly ALARM_FIRE_TIMEOUT_S=150
readonly CRASH_PATTERN='FATAL EXCEPTION|ClassNotFoundException|NoSuchMethodError|NoSuchMethodException|NullPointerException|has been rejected'

apk="${1:?usage: android-emulator-check.sh <apk> <output-dir>}"
out="${2:?usage: android-emulator-check.sh <apk> <output-dir>}"
maestro="${MAESTRO:-maestro}"
flows="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.maestro/ci" && pwd)"

mkdir -p "$out"
out="$(cd "$out" && pwd)"

step() { echo "::group::$1"; }
fail() {
  echo "::error::$1"
  exit 1
}

logcat_pids=()
trap 'kill "${logcat_pids[@]}" 2>/dev/null || true' EXIT

adb wait-for-device
# The default ring buffer drops lines over a run this long.
adb logcat -G 16M
adb logcat -c
adb logcat -v threadtime >"$out/logcat.txt" 2>&1 &
logcat_pids+=($!)

step "Install"
# Location off makes Play services prompt over the app; on, the fix is used.
adb shell cmd location set-location-enabled true
adb emu geo fix "${GEO_FIX[@]}"
# A fresh install is what shows onboarding.
adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install -g "$apk"
app_uid="$(adb shell cmd package list packages -U "$APP_ID" | sed -n 's/.*uid:\([0-9]*\).*/\1/p' | tr -d '\r')"
[ -n "$app_uid" ] || fail "$APP_ID is not installed"
# Every process the app starts shares its uid, so restarts stay in this log.
adb logcat -v threadtime --uid="$app_uid" >"$out/logcat-app.txt" 2>&1 &
logcat_pids+=($!)
echo "::endgroup::"

# A loaded runner can drop the emulator off adb for a moment; reconnect before failing.
ensure_device() {
  adb reconnect offline >/dev/null 2>&1 || true
  timeout 90 adb wait-for-device || fail "The emulator went offline (runner fault, not the app)"
}

run_flow() {
  step "Maestro: $1"
  ensure_device
  "$maestro" test --test-output-dir "$out/maestro/$1" "$flows/$1.yaml"
  echo "::endgroup::"
}

run_flow onboarding
run_flow alarm-enable

step "Fajr alarm reaches AlarmManager"
# The next alarm clock must be an AlarmReceiver alarm this app set at that time.
alarm_dump=""
for _ in $(seq 1 20); do
  alarm_dump="$(adb shell dumpsys alarm)"
  next_ms="$(grep -A1 "Next alarm clock information:" <<<"$alarm_dump" | sed -n 's/.*time:\([0-9]*\).*/\1/p')"
  if [ -n "$next_ms" ] &&
    grep -A1 "origWhen $next_ms .*$APP_ID}" <<<"$alarm_dump" | grep -q "$APP_ID/expo.modules.alarm.AlarmReceiver"; then
    break
  fi
  next_ms=""
  sleep 1
done
printf '%s\n' "$alarm_dump" >"$out/dumpsys-alarm.txt"
[ -n "$next_ms" ] || fail "No AlarmReceiver alarm clock from $APP_ID in dumpsys alarm"
grep -A1 "Next alarm clock information:" <<<"$alarm_dump"
echo "::endgroup::"

run_flow alarm-debug-schedule
# Read after the tap: the test alarm rings 60 s later, so no earlier alarm can count.
since="$(adb shell "date '+%m-%d %H:%M:%S.000'" | tr -d '\r')"

step "Test alarm fires"
fired=false
for _ in $(seq 1 "$ALARM_FIRE_TIMEOUT_S"); do
  fire_log="$(adb logcat -d -T "$since" -s AlarmReceiver:D AlarmService:D)"
  if grep -q "AlarmReceiver.*Alarm received" <<<"$fire_log" &&
    grep -q "AlarmService.*Alarm ringing" <<<"$fire_log"; then
    fired=true
    break
  fi
  sleep 1
done
$fired || fail "The 1-minute test alarm did not log 'Alarm received' and 'Alarm ringing'"
grep -E "Alarm received|Alarm ringing" <<<"$fire_log"
# The ringing alarm owns the screen; a stop ends it before the smoke run.
adb shell am force-stop "$APP_ID"
echo "::endgroup::"

run_flow smoke

step "App is alive and logged no crash"
ensure_device
adb shell pidof "$APP_ID" >/dev/null || fail "$APP_ID is not running after the smoke flow"
sleep 2
if grep -E "$CRASH_PATTERN" "$out/logcat-app.txt"; then
  fail "The app logged a crash or a rejected native call; see logcat-app.txt"
fi
echo "::endgroup::"
echo "Emulator checks passed."

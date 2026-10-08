#!/usr/bin/env bash
# Checks a release APK on the booted emulator: onboarding, alarms, top screens.
# MAESTRO overrides the maestro binary.
set -euo pipefail

# shellcheck source=scripts/ci/emulator-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/emulator-lib.sh"

readonly ALARM_FIRE_TIMEOUT_S=150
readonly CRASH_PATTERN='FATAL EXCEPTION|ClassNotFoundException|NoSuchMethodError|NoSuchMethodException|NullPointerException|has been rejected'

apk="${1:?usage: android-emulator-check.sh <apk> <output-dir>}"
out="${2:?usage: android-emulator-check.sh <apk> <output-dir>}"
maestro="${MAESTRO:-maestro}"
flows="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.maestro/ci" && pwd)"

mkdir -p "$out"
out="$(cd "$out" && pwd)"

start_device_log "$out"

step "Install"
# A fresh install is what shows onboarding.
install_fresh "$apk" "$out"
echo "::endgroup::"

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

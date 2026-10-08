#!/usr/bin/env bash
# Compares the visual set with .maestro/ci/baselines on the booted emulator;
# a shot with no baseline is recorded instead. MAESTRO overrides the binary.
set -euo pipefail

# shellcheck source=scripts/ci/emulator-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/emulator-lib.sh"

readonly SCREENS=(
  prayer-times
  athkar
  settings
  settings-appearance
  settings-language
  settings-text-size
  settings-hijri
  settings-privacy
)
readonly LOCALES=(ar en)
readonly THEMES=(light dark)
# The status bar clock matches the moment the app is pinned to.
readonly DEMO_CLOCK=1046
readonly TIMEZONE="Asia/Riyadh"

apk="${1:?usage: visual-check.sh <apk> <output-dir>}"
out="${2:?usage: visual-check.sh <apk> <output-dir>}"
maestro="${MAESTRO:-maestro}"
flows="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.maestro/ci" && pwd)"
baselines="$flows/baselines"

mkdir -p "$out/visual-baselines" "$out/visual-diffs"
out="$(cd "$out" && pwd)"

# Seeds named in src/screenshot-mode/presets.
seed_for() {
  case "$1" in
    prayer-times) echo "makkah-dhuhr-2h14m" ;;
    athkar) echo "morning-3-of-10" ;;
    *) echo "default" ;;
  esac
}

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }

# Holds everything around the app still, so only the app can change a pixel.
pin_device() {
  adb shell settings put global sysui_demo_allowed 1
  demo enter
  demo clock -e hhmm "$DEMO_CLOCK"
  demo battery -e level 100 -e plugged false
  # Signal icons follow the emulator's network even in demo mode; hide them.
  demo network -e wifi hide -e mobile hide -e nosim hide -e airplane hide
  demo status -e volume hide -e bluetooth hide -e location hide -e alarm hide -e sync hide -e mute hide
  demo notifications -e visible false
  adb shell settings put global auto_time_zone 0
  adb shell cmd alarm set-timezone "$TIMEZONE"
  adb shell cmd uimode night no
  adb shell settings put system font_scale 1.0
  for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$scale" 0
  done
}

# One Maestro session runs every shot in order, as flows of one suite.
suite="$out/visual-suite"
order=()

# Adds a flow that runs visual.yaml: <mode> <screen> <locale> <theme>.
# A retry absorbs a slow cold start; a real difference fails both tries.
add_flow() {
  local mode="$1" screen="$2" locale="$3" theme="$4"
  local name
  name="$(printf '%02d' "${#order[@]}")-$mode-$screen-$locale-$theme"
  cat >"$suite/$name.yaml" <<EOF
appId: $APP_ID
---
- retry:
    maxRetries: 1
    file: lib/visual.yaml
    env:
      MODE: $mode
      SCREEN: $screen
      LOCALE: $locale
      THEME: $theme
      SEED: $(seed_for "$screen")
      SHOT: $screen-$locale-$theme
EOF
  order+=("$name")
}

start_device_log "$out"

step "Install"
install_fresh "$apk" "$out"
echo "::endgroup::"

step "Pin the device"
pin_device
echo "::endgroup::"

step "Plan the shots"
mkdir -p "$suite/lib/baselines"
cp "$flows/visual.yaml" "$suite/lib/visual.yaml"
# Maestro reads each baseline beside the flow and writes its diff there too.
if [ -d "$baselines" ]; then
  find "$baselines" -maxdepth 1 -name '*.png' -exec cp {} "$suite/lib/baselines/" \;
fi
recorded=()
asserted=()
for locale in "${LOCALES[@]}"; do
  # Native RTL follows the locale only from the next launch.
  add_flow prime "${SCREENS[0]}" "$locale" "${THEMES[0]}"
  for screen in "${SCREENS[@]}"; do
    for theme in "${THEMES[@]}"; do
      shot="$screen-$locale-$theme"
      if [ -f "$suite/lib/baselines/$shot.png" ]; then
        add_flow assert "$screen" "$locale" "$theme"
        asserted+=("$shot")
      else
        add_flow record "$screen" "$locale" "$theme"
        recorded+=("$shot")
      fi
    done
  done
done
{
  echo "executionOrder:"
  echo "  continueOnFailure: true"
  echo "  flowsOrder:"
  printf '    - "%s"\n' "${order[@]}"
} >"$suite/config.yaml"
echo "${#asserted[@]} to compare, ${#recorded[@]} to record"
echo "::endgroup::"

step "Maestro: visual suite"
ensure_device
"$maestro" test \
  --format junit \
  --output "$out/visual-report.xml" \
  --test-output-dir "$out/maestro" \
  "$suite" || true
echo "::endgroup::"

[ -s "$out/visual-report.xml" ] || fail "Maestro wrote no report; see the suite output above"
failed=()
while IFS= read -r name; do
  failed+=("${name#*-*-}")
done < <(sed -n 's/.*<testcase [^>]*name="\([^"]*\)"[^>]*status="ERROR".*/\1/p' "$out/visual-report.xml")

find "$suite/lib/baselines" -name '*_diff.png' -exec mv {} "$out/visual-diffs/" \;
saved=()
for shot in ${recorded[@]+"${recorded[@]}"}; do
  taken="$(find "$out/maestro" -type f -name "$shot.png" | head -n 1)"
  if [ -n "$taken" ]; then
    cp "$taken" "$out/visual-baselines/$shot.png"
    saved+=("$shot")
  fi
done

if [ "${#saved[@]}" -gt 0 ]; then
  echo "::warning::Recorded ${#saved[@]} shot(s) with no baseline; review and commit them to .maestro/ci/baselines: ${saved[*]}"
fi
if [ "${#failed[@]}" -gt 0 ]; then
  fail "${#failed[@]} flow(s) failed: ${failed[*]}"
fi
echo "Visual check passed."

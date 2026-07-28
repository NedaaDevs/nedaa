#!/bin/bash
set -e

# Recovers from stale Gradle state where an autolinked Expo module's Kotlin compile task is
# UP-TO-DATE while its output directory holds no classes. The missing class only surfaces
# downstream, as "Unresolved reference" in expo's generated ExpoModulesPackageList.kt, so the
# error never names the module that actually failed to build.
#
# Usage:
#   ./scripts/fix-stale-expo-modules.sh                  # detect and repair
#   ./scripts/fix-stale-expo-modules.sh expo-log-box     # repair named Gradle projects
#   VARIANT=release ./scripts/fix-stale-expo-modules.sh  # target a variant other than debug

VARIANT="${VARIANT:-debug}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

capitalized="$(echo "${VARIANT:0:1}" | tr '[:lower:]' '[:upper:]')${VARIANT:1}"

projects=("$@")

if [ ${#projects[@]} -eq 0 ]; then
  echo "Scanning autolinked Expo modules for empty Kotlin output ($VARIANT)..."

  candidates="$(
    node "$ROOT/node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js" \
      resolve -p android --json |
      VARIANT="$VARIANT" node -e '
        const fs = require("fs");
        const path = require("path");

        const variant = process.env.VARIANT;

        // Recursive extension check — Expo modules vary in source layout, and @expo/log-box
        // nests sources directly under src/main with no java/ or kotlin/ segment.
        const containsExt = (dir, ext) => {
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return false;
          }
          return entries.some((entry) => {
            const full = path.join(dir, entry.name);
            return entry.isDirectory() ? containsExt(full, ext) : entry.name.endsWith(ext);
          });
        };

        let input = "";
        process.stdin.on("data", (chunk) => (input += chunk));
        process.stdin.on("end", () => {
          for (const module of JSON.parse(input).modules ?? []) {
            for (const project of module.projects ?? []) {
              const { name, sourceDir } = project;
              const build = path.join(sourceDir, "build");

              // AGP always generates BuildConfig, so javac output for this variant means the
              // variant was built — the only case where empty Kotlin output is anomalous
              // rather than simply absent.
              if (!fs.existsSync(path.join(build, "intermediates", "javac", variant))) continue;
              if (!containsExt(path.join(sourceDir, "src"), ".kt")) continue;
              if (containsExt(path.join(build, "tmp", "kotlin-classes", variant), ".class")) continue;

              console.log(name);
            }
          }
        });
      '
  )"

  if [ -z "$candidates" ]; then
    echo "No stale modules found."
    exit 0
  fi

  cd "$ROOT/android"

  # settings.gradle drops mutually exclusive modules per BUILD_VARIANT, and leftover build
  # output from the other variant would otherwise resolve to a nonexistent Gradle project.
  available="$(./gradlew projects -q --console=plain | sed -n "s/.*Project ':\([^']*\)'.*/\1/p")"

  while IFS= read -r candidate; do
    if grep -qxF "$candidate" <<<"$available"; then
      projects+=("$candidate")
    else
      echo "Skipping $candidate — excluded from the ${BUILD_VARIANT:-gms} project graph."
    fi
  done <<<"$candidates"

  if [ ${#projects[@]} -eq 0 ]; then
    echo "No stale modules found."
    exit 0
  fi
fi

echo "Recompiling: ${projects[*]}"

tasks=()
for project in "${projects[@]}"; do
  tasks+=(":$project:compile${capitalized}Kotlin")
done

cd "$ROOT/android"
./gradlew "${tasks[@]}" --rerun-tasks --console=plain

echo "Stale modules recompiled!"

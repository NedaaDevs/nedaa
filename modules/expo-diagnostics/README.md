# expo-diagnostics

Buffers OS-level diagnostics and exposes them to JS via `drain()`.

- **iOS:** MetricKit `MXCrashDiagnostic` (→ `crash`) and `MXHangDiagnostic` (→ `hang`),
  persisted to `Application Support/diagnostics-inbox/` on delivery. Does not fire on
  Simulator — verify via TestFlight/release.
- **Android:** `ApplicationExitInfo` (API 30+): `REASON_CRASH`/`REASON_CRASH_NATIVE` → `crash`,
  `REASON_ANR` → `anr`, `REASON_LOW_MEMORY` → `memory`, signalled/excessive-resource → `other`.
  Returns `[]` below API 30. AOSP — works on HMS builds.

## Consumption

`src/utils/nativeDiagnostics.ts` calls `drain()` at startup (best-effort, non-blocking),
logs each entry into the `crash` log domain, and writes the crash sentinel (via
`writeNativePendingReport`) for `crash`/`anr` so `CrashReportPrompt` shows this launch.

## Privacy manifest

No change required for this module. Diagnostics stay on-device; nothing leaves until the
future feedback-submit feature ships (which will update `NSPrivacyCollectedDataTypes`). File
access and UserDefaults are already declared in `ios/nedaa/PrivacyInfo.xcprivacy`. MetricKit is
not a required-reason API, and App Attest is a capability/entitlement, not a required-reason API.

## Attestation (separate `@expo/app-integrity` wrapper in `src/utils/attestation.ts`)

Attestation is NOT part of this native module — it wraps the official `@expo/app-integrity`
package. Setup:

- **iOS:** App Attest capability + `com.apple.developer.devicecheck.appattest-environment`
  entitlement (`production`, already in `ios/Nedaa/nedaa.entitlements`). Needs a registered App ID.
- **Android:** Play Integrity — enable in Play Console, set `CLOUD_PROJECT_NUMBER` in
  `src/constants/Attestation.ts` to the Google Cloud project number. Requires GMS; resolves
  `null` on HMS/no-GMS builds by design.
- The Android wrapper uses the **standard** Play Integrity request flow (challenge as request
  hash) — the backend verifier must decode standard-flow tokens accordingly.

# expo-diagnostics

Buffers OS-level diagnostics and exposes them to JS via `drain()` + `ack()`.

**Peek/ack protocol:** `drain()` returns records without consuming them; the native side
consumes (Android: cursor advance, iOS: file delete) only when JS calls `ack(tokens)` after
the log write is flushed to disk. A crash between drain and ack replays the records on the
next launch instead of losing them; entry `id`s are stable across replays for dedup.

- **iOS:** MetricKit `MXCrashDiagnostic` (→ `crash`) and `MXHangDiagnostic` (→ `hang`),
  persisted atomically to `Application Support/diagnostics-inbox/` on delivery; unreadable
  or oversized files are quarantined as `.bad`, never silently deleted. Does not fire on
  Simulator — verify via TestFlight/release.
  The detail leads with `CallStackCompactor`'s attributed-thread stack (`#NN binary
+0xOFFSET (uuid)` — symbolicate offline with the build's dSYMs) followed by the FULL
  diagnostic JSON (metadata, virtual-memory info, all threads), so the 64KB cap can only
  truncate the raw tail, never the crashed thread. Verify with
  `ios/scripts/CallStackCompactorTest.swift` (standalone swiftc script — no XCTest target).
- **Android:** `ApplicationExitInfo` (API 30+): crash/native-crash/init-failure → `crash`,
  `REASON_ANR` → `anr`, low-memory and SIGKILL-signalled (LMK fallback) → `memory`,
  other signals/excessive-resource → `other`. Returns `[]` below API 30. AOSP — works on
  HMS builds.
  `getTraceInputStream()` is format-polymorphic: text for ANRs, a binary tombstone protobuf
  (AOSP `debuggerd/proto/tombstone.proto`) for native crashes. `TombstoneParser` decodes the
  latter into a debuggerd-style summary (signal, abort message, causes, crashing-thread
  backtrace with `rel_pc` + BuildId); unparseable tombstones are kept as base64 for offline
  decoding. Verify the parser with `android/scripts/TombstoneParserTest.kt` (standalone
  kotlinc script — no Android test target in this module).

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

- **iOS:** NOT enabled. The `com.apple.developer.devicecheck.appattest-environment` entitlement
  fails App Store signing until App Attest is enabled on the `dev.nedaa.app` App ID in the Apple
  Developer portal and the provisioning profile is regenerated. Do all three together when
  attestation is actually wired: enable the capability, regenerate the profile, add the
  entitlement to `ios/nedaa/nedaa.entitlements`. `attest()` resolves `null` until then.
- **Android:** Play Integrity — enable in Play Console, set `CLOUD_PROJECT_NUMBER` in
  `src/constants/Attestation.ts` to the Google Cloud project number. Requires GMS; resolves
  `null` on HMS/no-GMS builds by design.
- The Android wrapper uses the **standard** Play Integrity request flow (challenge as request
  hash) — the backend verifier must decode standard-flow tokens accordingly.

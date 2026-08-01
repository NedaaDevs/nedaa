import { requireOptionalNativeModule } from "expo-modules-core";

import type { NativeDiagnostic } from "./ExpoDiagnostics.types";

export { NativeDiagnosticKind } from "./ExpoDiagnostics.types";
export type { NativeDiagnostic } from "./ExpoDiagnostics.types";

const NativeModule = requireOptionalNativeModule<{
  drain(): Promise<NativeDiagnostic[]>;
  ack?(tokens: string[]): Promise<void>;
  testNativeCrash?(): void;
  testHang?(): void;
  testAnr?(): void;
}>("ExpoDiagnostics");

export const ExpoDiagnosticsModule = {
  isAvailable: NativeModule !== null,
  async drain(): Promise<NativeDiagnostic[]> {
    if (!NativeModule) return [];
    return NativeModule.drain();
  },
  // Confirms the drained entries are durably persisted; the native side consumes the
  // underlying records only on ack. Optional-chained: a JS update can reach binaries
  // that predate the ack API.
  async ack(tokens: string[]): Promise<void> {
    await NativeModule?.ack?.(tokens);
  },
  // Debug crash triggers — force a real native crash so the drain path can be exercised
  // end-to-end on device. Present on both platforms.
  testNativeCrash(): void {
    NativeModule?.testNativeCrash?.();
  },
  // Main-thread block: MXHangDiagnostic on iOS. No-op on Android.
  testHang(): void {
    NativeModule?.testHang?.();
  },
  // Main-thread block past the ANR timeout: REASON_ANR on Android. No-op on iOS.
  testAnr(): void {
    NativeModule?.testAnr?.();
  },
};

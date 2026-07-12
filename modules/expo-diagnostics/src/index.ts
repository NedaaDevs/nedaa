import { requireOptionalNativeModule } from "expo-modules-core";

import type { NativeDiagnostic } from "./ExpoDiagnostics.types";

export { NativeDiagnosticKind } from "./ExpoDiagnostics.types";
export type { NativeDiagnostic } from "./ExpoDiagnostics.types";

const NativeModule = requireOptionalNativeModule<{
  drain(): Promise<NativeDiagnostic[]>;
}>("ExpoDiagnostics");

export const ExpoDiagnosticsModule = {
  isAvailable: NativeModule !== null,
  async drain(): Promise<NativeDiagnostic[]> {
    if (!NativeModule) return [];
    return NativeModule.drain();
  },
};

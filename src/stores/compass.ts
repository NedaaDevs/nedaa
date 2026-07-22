import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CompassLocationFix } from "@/types/compass";

type CompassStore = {
  lastVerifiedFix: CompassLocationFix | null;
  setLastVerifiedFix: (fix: CompassLocationFix) => void;
  clearLastVerifiedFix: () => void;
};

export const isValidCompassLocationFix = (value: unknown): value is CompassLocationFix => {
  if (!value || typeof value !== "object") return false;

  const fix = value as Partial<CompassLocationFix>;
  return (
    typeof fix.latitude === "number" &&
    Number.isFinite(fix.latitude) &&
    fix.latitude >= -90 &&
    fix.latitude <= 90 &&
    typeof fix.longitude === "number" &&
    Number.isFinite(fix.longitude) &&
    fix.longitude >= -180 &&
    fix.longitude <= 180 &&
    typeof fix.accuracyMeters === "number" &&
    Number.isFinite(fix.accuracyMeters) &&
    fix.accuracyMeters > 0 &&
    (fix.altitude === null ||
      (typeof fix.altitude === "number" && Number.isFinite(fix.altitude))) &&
    typeof fix.timestamp === "number" &&
    Number.isFinite(fix.timestamp) &&
    fix.timestamp > 0
  );
};

export const useCompassStore = create<CompassStore>()(
  persist(
    (set) => ({
      lastVerifiedFix: null,
      setLastVerifiedFix: (fix) => {
        if (isValidCompassLocationFix(fix)) set({ lastVerifiedFix: fix });
      },
      clearLastVerifiedFix: () => set({ lastVerifiedFix: null }),
    }),
    {
      name: "compass-storage",
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        lastVerifiedFix: state.lastVerifiedFix,
      }),
      // Older persisted states also carried a mode `preference`; it is ignored here on purpose.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CompassStore> | undefined;
        return {
          ...currentState,
          lastVerifiedFix: isValidCompassLocationFix(persisted?.lastVerifiedFix)
            ? persisted.lastVerifiedFix
            : null,
        };
      },
    }
  )
);

export default useCompassStore;

import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CompassLocationPreference, type CompassLocationPreferenceValue } from "@/enums/compass";
import type { CompassLocationFix } from "@/types/compass";

type CompassStore = {
  preference: CompassLocationPreferenceValue;
  lastVerifiedFix: CompassLocationFix | null;
  setPreference: (preference: CompassLocationPreferenceValue) => void;
  setLastVerifiedFix: (fix: CompassLocationFix) => void;
  clearLastVerifiedFix: () => void;
};

const isCompassLocationPreference = (value: unknown): value is CompassLocationPreferenceValue =>
  value === CompassLocationPreference.ASK ||
  value === CompassLocationPreference.QIBLA ||
  value === CompassLocationPreference.COMPASS_ONLY;

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
      preference: CompassLocationPreference.ASK,
      lastVerifiedFix: null,
      setPreference: (preference) => set({ preference }),
      setLastVerifiedFix: (fix) => {
        if (isValidCompassLocationFix(fix)) set({ lastVerifiedFix: fix });
      },
      clearLastVerifiedFix: () => set({ lastVerifiedFix: null }),
    }),
    {
      name: "compass-storage",
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        preference: state.preference,
        lastVerifiedFix: state.lastVerifiedFix,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CompassStore> | undefined;
        const preference = isCompassLocationPreference(persisted?.preference)
          ? persisted.preference
          : currentState.preference;
        return {
          ...currentState,
          preference,
          lastVerifiedFix: isValidCompassLocationFix(persisted?.lastVerifiedFix)
            ? persisted.lastVerifiedFix
            : null,
        };
      },
    }
  )
);

export default useCompassStore;

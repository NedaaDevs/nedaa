import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ALARM_GUIDE_STORE_KEY } from "@/constants/DB";

type AlarmGuideStore = {
  /** Set by any close of the guide, so it opens by itself only once. */
  hasSeenGuide: boolean;
  markGuideSeen: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const useAlarmGuideStore = create<AlarmGuideStore>()(
  persist(
    (set) => ({
      hasSeenGuide: false,
      markGuideSeen: () => set({ hasSeenGuide: true }),
    }),
    {
      name: ALARM_GUIDE_STORE_KEY,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({ hasSeenGuide: state.hasSeenGuide }),
      // Seen is a saved true, or a mark made before the read resolved.
      merge: (persisted, current) => ({
        ...current,
        hasSeenGuide:
          current.hasSeenGuide || (isRecord(persisted) && persisted.hasSeenGuide === true),
      }),
    }
  )
);

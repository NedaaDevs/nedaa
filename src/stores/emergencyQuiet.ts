import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { EMERGENCY_QUIET_STORE_KEY } from "@/constants/DB";
import type { EmergencyQuietAllowance } from "@/constants/EmergencyQuiet";
import {
  NEW_QUIET_LEDGER,
  readPersistedLedger,
  recordUse,
  setAllowance,
  settleClock,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

type EmergencyQuietStore = {
  /** One allowance and count for every alarm type. */
  ledger: QuietLedger;
  /** Counts one use; throws when none is left, counting nothing. */
  recordUse: (now: number) => void;
  setAllowance: (allowance: EmergencyQuietAllowance, now: number) => void;
};

export const useEmergencyQuietStore = create<EmergencyQuietStore>()(
  persist(
    (set, get) => ({
      ledger: NEW_QUIET_LEDGER,
      recordUse: (now) => {
        const ledger = recordUse(get().ledger, now);
        if (!ledger) throw new Error("no emergency quiet left this month");
        set({ ledger });
      },
      setAllowance: (allowance, now) => set({ ledger: setAllowance(get().ledger, allowance, now) }),
    }),
    {
      name: EMERGENCY_QUIET_STORE_KEY,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({ ledger: state.ledger }),
      // Persist writes the merged state back, so a clock set back is saved.
      merge: (persisted, current) => ({
        ...current,
        ledger: settleClock(readPersistedLedger(persisted), Date.now()),
      }),
    }
  )
);

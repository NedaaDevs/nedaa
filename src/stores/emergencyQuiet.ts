import * as ExpoAlarm from "expo-alarm";
import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { EMERGENCY_QUIET_STORE_KEY } from "@/constants/DB";
import type { EmergencyQuietAllowance } from "@/constants/EmergencyQuiet";
import { AppLogger } from "@/utils/appLogger";
import {
  NEW_QUIET_LEDGER,
  readLedger,
  readPersistedLedger,
  recordUse,
  setAllowance,
  settleClock,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

type EmergencyQuietStore = {
  /** One allowance and count for every alarm type. */
  ledger: QuietLedger;
  /** Counts one use; throws, counting nothing, if none is left or known. */
  recordUse: (now: number) => void;
  setAllowance: (allowance: EmergencyQuietAllowance, now: number) => void;
  /** Reads the count the Android overlay may have spent; logs a failed read. */
  refresh: () => void;
};

const log = AppLogger.create("alarm");

// On Android the alarm database holds the count, so the overlay spends it with
// the app closed; the saved ledger here seeds it once and caches it.
const native = ExpoAlarm.hasNativeQuietLedger();

const NONE_LEFT = "no emergency quiet left this month";
const NOT_SEEDED = "the alarm database has no quiet count yet";

// True once the alarm database holds the app's ledger; a refresh seeds until then.
let seeded = false;

const seed = (ledger: QuietLedger, now: number): QuietLedger => {
  try {
    const answer = readLedger(ExpoAlarm.seedQuietLedger(ledger, now));
    seeded = true;
    return answer;
  } catch (error) {
    log.w("Quiet", `seeding the quiet count failed: ${String(error)}`);
    return ledger;
  }
};

export const useEmergencyQuietStore = create<EmergencyQuietStore>()(
  persist(
    (set, get) => {
      // Seeds first while no seed has worked; true once one has.
      const seededBy = (now: number): boolean => {
        if (!seeded) set({ ledger: seed(get().ledger, now) });
        return seeded;
      };
      return {
        ledger: NEW_QUIET_LEDGER,
        recordUse: (now) => {
          if (native && !seededBy(now)) throw new Error(NOT_SEEDED);
          const spent = native ? ExpoAlarm.recordQuietUse(now) : recordUse(get().ledger, now);
          if (!spent) throw new Error(NONE_LEFT);
          set({ ledger: readLedger(spent) });
        },
        // Without a ledger row the change stays in the saved ledger, and the
        // next seed writes it. A failed database write changes nothing.
        setAllowance: (allowance, now) => {
          if (native && seededBy(now)) {
            try {
              const answer = ExpoAlarm.setQuietAllowance(allowance, now);
              if (answer) {
                set({ ledger: readLedger(answer) });
                return;
              }
              seeded = false;
            } catch (error) {
              log.w("Quiet", `saving the quiet allowance failed: ${String(error)}`);
              return;
            }
          }
          set({ ledger: setAllowance(get().ledger, allowance, now) });
        },
        refresh: () => {
          if (!native || !useEmergencyQuietStore.persist.hasHydrated()) return;
          const { ledger } = get();
          try {
            set({
              ledger: seeded ? readLedger(ExpoAlarm.getQuietLedger()) : seed(ledger, Date.now()),
            });
          } catch (error) {
            log.w("Quiet", `reading the quiet count failed: ${String(error)}`);
          }
        },
      };
    },
    {
      name: EMERGENCY_QUIET_STORE_KEY,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({ ledger: state.ledger }),
      merge: (persisted, current) => ({ ...current, ledger: readPersistedLedger(persisted) }),
      // Hydration saves nothing, so the settled or seeded ledger is set here.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const now = Date.now();
        const ledger = native ? seed(state.ledger, now) : settleClock(state.ledger, now);
        if (ledger !== state.ledger) useEmergencyQuietStore.setState({ ledger });
      },
    }
  )
);

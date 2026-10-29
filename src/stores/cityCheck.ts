import { SQLiteStorage } from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { KEPT_MAX, NOT_ASKED_MAX } from "@/constants/CityCheck";
import { CITY_CHECK_STORAGE_DB_NAME, CITY_CHECK_STORE_KEY } from "@/constants/DB";
import type { CityCheckMemory, PlaceMark } from "@/types/cityCheck";
import { withMark } from "@/utils/cityCheck/marks";

export const EMPTY_MEMORY: CityCheckMemory = {
  lastCheckAt: null,
  lastPhoneZone: null,
  kept: [],
  notAsked: [],
};

type CityCheckStore = {
  cityCheck: CityCheckMemory;
  noteCheckStarted: (phoneZone: string | null) => void;
  noteCheckFinished: (at: number) => void;
  setKept: (kept: PlaceMark[]) => void;
  keep: (mark: PlaceMark) => void;
  forgetLastCheck: () => void;
  clearMemory: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isMark = (value: unknown): value is PlaceMark =>
  isRecord(value) &&
  isFiniteNumber(value.lat) &&
  isFiniteNumber(value.lng) &&
  isFiniteNumber(value.at);

// Valid marks only, newest first, at most `max`.
const marksFrom = (value: unknown, max: number): PlaceMark[] =>
  Array.isArray(value)
    ? value
        .filter(isMark)
        .sort((a, b) => b.at - a.at)
        .slice(0, max)
    : [];

// A saved record from any build loads; anything malformed reads as empty.
const memoryFrom = (saved: unknown): CityCheckMemory => {
  if (!isRecord(saved)) return EMPTY_MEMORY;
  return {
    lastCheckAt: isFiniteNumber(saved.lastCheckAt) ? saved.lastCheckAt : null,
    lastPhoneZone: typeof saved.lastPhoneZone === "string" ? saved.lastPhoneZone : null,
    kept: marksFrom(saved.kept, KEPT_MAX),
    notAsked: marksFrom(saved.notAsked, NOT_ASKED_MAX),
  };
};

export const useCityCheckStore = create<CityCheckStore>()(
  persist(
    (set) => {
      const update = (change: Partial<CityCheckMemory>) =>
        set((state) => ({ cityCheck: { ...state.cityCheck, ...change } }));
      return {
        cityCheck: EMPTY_MEMORY,
        noteCheckStarted: (phoneZone) => update({ lastPhoneZone: phoneZone }),
        noteCheckFinished: (at) => update({ lastCheckAt: at }),
        setKept: (kept) => update({ kept }),
        keep: (mark) =>
          set((state) => ({
            cityCheck: { ...state.cityCheck, kept: withMark(state.cityCheck.kept, mark, KEPT_MAX) },
          })),
        forgetLastCheck: () => update({ lastCheckAt: null }),
        clearMemory: () => set({ cityCheck: EMPTY_MEMORY }),
      };
    },
    {
      name: CITY_CHECK_STORE_KEY,
      storage: createJSONStorage(() => new SQLiteStorage(CITY_CHECK_STORAGE_DB_NAME)),
      partialize: (state) => ({ cityCheck: state.cityCheck }),
      merge: (persisted, current) => ({
        ...current,
        cityCheck: memoryFrom(isRecord(persisted) ? persisted.cityCheck : null),
      }),
    }
  )
);

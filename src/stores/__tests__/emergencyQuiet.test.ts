import Storage from "expo-sqlite/kv-store";

import { EMERGENCY_QUIET_STORE_KEY } from "@/constants/DB";
import { EMERGENCY_QUIET_ALLOWANCE } from "@/constants/EmergencyQuiet";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import {
  NEW_QUIET_LEDGER,
  monthKeyOf,
  recordUse,
  setAllowance,
  usesLeft,
} from "@/utils/emergencyQuiet";

const storage = jest.mocked(Storage);
const { ONE, TWO, THREE } = EMERGENCY_QUIET_ALLOWANCE;

const saved = (state: unknown) => JSON.stringify({ state, version: 0 });
const NOW = new Date(2026, 10, 21, 5).getTime();
const NEXT_MONTH = new Date(2026, 11, 1, 5).getTime();
const NEXT_YEAR = new Date(2027, 10, 21, 5).getTime();

const left = (now: number) => usesLeft(useEmergencyQuietStore.getState().ledger, now);

// A restart reads the ledger against the clock, so the clock is pinned.
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  useEmergencyQuietStore.setState({ ledger: NEW_QUIET_LEDGER });
  storage.setItem.mockClear();
});

afterEach(() => jest.useRealTimers());

describe("the emergency quiet count", () => {
  it("counts each use down from the allowance", () => {
    const store = useEmergencyQuietStore.getState();

    store.recordUse(NOW);

    expect(left(NOW)).toBe(TWO - 1);
  });

  it("throws on a use with none left, and counts nothing", () => {
    const store = useEmergencyQuietStore.getState();
    store.setAllowance(ONE, NOW);
    store.recordUse(NOW);
    const before = useEmergencyQuietStore.getState().ledger;

    expect(() => useEmergencyQuietStore.getState().recordUse(NOW)).toThrow();
    expect(useEmergencyQuietStore.getState().ledger).toBe(before);
  });

  it("raises from the next month", () => {
    useEmergencyQuietStore.getState().setAllowance(THREE, NOW);

    expect(left(NOW)).toBe(TWO);
    expect(left(NEXT_MONTH)).toBe(THREE);
  });

  it("writes only the ledger under its own key", () => {
    useEmergencyQuietStore.getState().recordUse(NOW);

    expect(storage.setItem).toHaveBeenLastCalledWith(
      EMERGENCY_QUIET_STORE_KEY,
      saved({ ledger: useEmergencyQuietStore.getState().ledger })
    );
  });

  it("reads a saved ledger back after a restart", async () => {
    const ledger = setAllowance(NEW_QUIET_LEDGER, ONE, NOW);
    storage.getItem.mockResolvedValueOnce(saved({ ledger }));

    await useEmergencyQuietStore.persist.rehydrate();

    expect(storage.getItem).toHaveBeenLastCalledWith(EMERGENCY_QUIET_STORE_KEY);
    expect(useEmergencyQuietStore.persist.hasHydrated()).toBe(true);
    expect(useEmergencyQuietStore.getState().ledger).toEqual(ledger);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("moves a ledger written ahead of the clock to the clock's month", async () => {
    const ahead = recordUse(NEW_QUIET_LEDGER, NEXT_YEAR);
    storage.getItem.mockResolvedValueOnce(saved({ ledger: ahead }));

    await useEmergencyQuietStore.persist.rehydrate();

    expect(useEmergencyQuietStore.getState().ledger).toEqual({
      ...ahead,
      month: monthKeyOf(NOW),
      lastWriteAt: NOW,
    });
    expect(left(NEXT_MONTH)).toBe(TWO);
  });

  it("saves a ledger rebased on a clock set back, so the next month refills", async () => {
    const ahead = recordUse(recordUse(NEW_QUIET_LEDGER, NEXT_YEAR) ?? NEW_QUIET_LEDGER, NEXT_YEAR);
    storage.getItem.mockResolvedValueOnce(saved({ ledger: ahead }));
    await useEmergencyQuietStore.persist.rehydrate();

    const [key, rebased] = storage.setItem.mock.lastCall ?? [];
    expect(key).toBe(EMERGENCY_QUIET_STORE_KEY);
    expect(left(NOW)).toBe(0);

    // The next restart reads what this one saved.
    jest.setSystemTime(NEXT_MONTH);
    storage.getItem.mockResolvedValueOnce(String(rebased));
    await useEmergencyQuietStore.persist.rehydrate();

    expect(left(NEXT_MONTH)).toBe(TWO);
  });

  it("reads a malformed ledger as a new one", async () => {
    storage.getItem.mockResolvedValueOnce(saved({ ledger: { allowance: 9 } }));

    await useEmergencyQuietStore.persist.rehydrate();

    expect(useEmergencyQuietStore.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });
});

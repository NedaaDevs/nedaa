import * as ExpoAlarm from "expo-alarm";
import Storage from "expo-sqlite/kv-store";

import { EMERGENCY_QUIET_ALLOWANCE } from "@/constants/EmergencyQuiet";
import type { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import {
  NEW_QUIET_LEDGER,
  recordUse,
  setAllowance,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

// Android: the alarm database holds the count, the store mirrors it.
jest.mock("expo-alarm", () => ({
  hasNativeQuietLedger: () => true,
  getQuietLedger: jest.fn(),
  seedQuietLedger: jest.fn(),
  recordQuietUse: jest.fn(),
  setQuietAllowance: jest.fn(),
}));

const alarm = jest.mocked(ExpoAlarm);
const storage = jest.mocked(Storage);
const { ONE, THREE } = EMERGENCY_QUIET_ALLOWANCE;

const NOW = new Date(2026, 10, 21, 5).getTime();
const SPENT: QuietLedger = recordUse(NEW_QUIET_LEDGER, NOW) ?? NEW_QUIET_LEDGER;
const saved = (state: unknown) => JSON.stringify({ state, version: 0 });
const SEED = { WORKS: "works", FAILS: "fails" } as const;
type Seed = (typeof SEED)[keyof typeof SEED];

const failSeed = () => {
  throw new Error("database locked");
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  for (const native of [
    alarm.getQuietLedger,
    alarm.seedQuietLedger,
    alarm.recordQuietUse,
    alarm.setQuietAllowance,
  ]) {
    native.mockReset();
  }
  alarm.seedQuietLedger.mockImplementation(failSeed);
});

afterEach(() => jest.useRealTimers());

// Each test loads its own store, so the seed state of one never reaches the next.
const loadStore = async (seed: Seed): Promise<typeof useEmergencyQuietStore> => {
  if (seed === SEED.WORKS) alarm.seedQuietLedger.mockReturnValueOnce(NEW_QUIET_LEDGER);
  let store: typeof useEmergencyQuietStore | undefined;
  jest.isolateModules(() => {
    // A static import hoists out of the callback; isolateModules needs a call-time require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require("@/stores/emergencyQuiet").useEmergencyQuietStore;
  });
  if (!store) throw new Error("the store did not load");
  await store.persist.rehydrate();
  jest.clearAllMocks();
  return store;
};

describe("the emergency quiet count on Android", () => {
  it("seeds again on refresh while the first seed failed, counting nothing twice", async () => {
    const store = await loadStore(SEED.FAILS);
    alarm.seedQuietLedger.mockReturnValueOnce(SPENT);

    store.getState().refresh();

    expect(alarm.seedQuietLedger).toHaveBeenLastCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.getQuietLedger).not.toHaveBeenCalled();
    expect(store.getState().ledger).toEqual(SPENT);
  });

  it("spends from the alarm database", async () => {
    const store = await loadStore(SEED.WORKS);
    alarm.recordQuietUse.mockReturnValueOnce(SPENT);

    store.getState().recordUse(NOW);

    expect(alarm.recordQuietUse).toHaveBeenCalledWith(NOW);
    expect(store.getState().ledger).toEqual(SPENT);
  });

  it("throws, counting nothing, when the database has none left", async () => {
    const store = await loadStore(SEED.WORKS);
    const before = store.getState().ledger;
    alarm.recordQuietUse.mockReturnValueOnce(null);

    expect(() => store.getState().recordUse(NOW)).toThrow();
    expect(store.getState().ledger).toBe(before);
  });

  it("sets the allowance in the alarm database", async () => {
    const store = await loadStore(SEED.WORKS);
    const raised = setAllowance(NEW_QUIET_LEDGER, THREE, NOW);
    alarm.setQuietAllowance.mockReturnValueOnce(raised);

    store.getState().setAllowance(THREE, NOW);

    expect(alarm.setQuietAllowance).toHaveBeenCalledWith(THREE, NOW);
    expect(store.getState().ledger).toEqual(raised);
  });

  it("keeps the ledger as it was when the database write fails", async () => {
    const store = await loadStore(SEED.WORKS);
    const before = store.getState().ledger;
    alarm.setQuietAllowance.mockImplementationOnce(() => {
      throw new Error("database locked");
    });

    expect(() => store.getState().setAllowance(ONE, NOW)).not.toThrow();
    expect(store.getState().ledger).toBe(before);
  });

  it("keeps the allowance in the saved ledger and seeds again when the database has no row", async () => {
    const store = await loadStore(SEED.WORKS);
    alarm.setQuietAllowance.mockReturnValueOnce(null);

    store.getState().setAllowance(THREE, NOW);
    const raised = setAllowance(NEW_QUIET_LEDGER, THREE, NOW);
    alarm.seedQuietLedger.mockReturnValueOnce(raised);
    store.getState().refresh();

    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(raised, expect.any(Number));
    expect(store.getState().ledger).toEqual(raised);
  });

  it("seeds the database with the saved ledger, then takes its answer", async () => {
    const store = await loadStore(SEED.FAILS);
    const ledger = setAllowance(NEW_QUIET_LEDGER, ONE, NOW);
    const joined = recordUse(ledger, NOW);
    storage.getItem.mockResolvedValueOnce(saved({ ledger }));
    alarm.seedQuietLedger.mockReturnValueOnce(joined ?? ledger);

    await store.persist.rehydrate();

    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(ledger, NOW);
    expect(store.getState().ledger).toEqual(joined);
  });

  it("reads a use the overlay counted with the app away, once seeded", async () => {
    const store = await loadStore(SEED.WORKS);
    alarm.getQuietLedger.mockReturnValueOnce(SPENT);

    store.getState().refresh();

    expect(alarm.seedQuietLedger).not.toHaveBeenCalled();
    expect(store.getState().ledger).toEqual(SPENT);
  });

  it("starts over from a malformed database answer", async () => {
    const store = await loadStore(SEED.WORKS);
    alarm.getQuietLedger.mockReturnValueOnce({
      allowance: 9,
      raise: null,
      month: null,
      used: 0,
      lastWriteAt: null,
    });

    store.getState().refresh();

    expect(store.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });
});

describe("the emergency quiet count before a seed has worked", () => {
  it("reads nothing on refresh until the saved ledger is loaded", async () => {
    const store = await loadStore(SEED.FAILS);
    jest.spyOn(store.persist, "hasHydrated").mockReturnValueOnce(false);

    store.getState().refresh();

    expect(alarm.seedQuietLedger).not.toHaveBeenCalled();
    expect(alarm.getQuietLedger).not.toHaveBeenCalled();
  });

  it("logs a failed read on refresh rather than throwing", async () => {
    const store = await loadStore(SEED.WORKS);
    alarm.getQuietLedger.mockImplementationOnce(() => {
      throw new Error("database locked");
    });

    expect(() => store.getState().refresh()).not.toThrow();
    expect(store.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });

  it("refuses a use without spending from the database while the seed fails", async () => {
    const store = await loadStore(SEED.FAILS);

    expect(() => store.getState().recordUse(NOW)).toThrow();
    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.recordQuietUse).not.toHaveBeenCalled();
    expect(store.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });

  it("changes no allowance while the seed fails", async () => {
    const store = await loadStore(SEED.FAILS);
    const before = store.getState().ledger;

    store.getState().setAllowance(THREE, NOW);

    expect(alarm.setQuietAllowance).not.toHaveBeenCalled();
    expect(store.getState().ledger).toBe(before);
  });

  it("shows the database's allowance once a seed works after a failed one", async () => {
    const store = await loadStore(SEED.FAILS);
    const held = setAllowance(SPENT, THREE, NOW);
    store.getState().setAllowance(ONE, NOW);
    alarm.seedQuietLedger.mockReturnValueOnce(held);

    store.getState().refresh();

    expect(alarm.seedQuietLedger).toHaveBeenLastCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(store.getState().ledger).toEqual(held);
  });

  it("seeds before it spends", async () => {
    const store = await loadStore(SEED.FAILS);
    alarm.seedQuietLedger.mockReturnValueOnce(NEW_QUIET_LEDGER);
    alarm.recordQuietUse.mockReturnValueOnce(SPENT);

    store.getState().recordUse(NOW);

    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.recordQuietUse).toHaveBeenCalledWith(NOW);
    expect(store.getState().ledger).toEqual(SPENT);
  });
});

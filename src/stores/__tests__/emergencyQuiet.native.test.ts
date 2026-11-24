import * as ExpoAlarm from "expo-alarm";
import Storage from "expo-sqlite/kv-store";

import { EMERGENCY_QUIET_ALLOWANCE } from "@/constants/EmergencyQuiet";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
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
  // The seed at import fails, so the first refresh must seed again.
  seedQuietLedger: jest.fn(() => {
    throw new Error("database locked");
  }),
  recordQuietUse: jest.fn(),
  setQuietAllowance: jest.fn(),
}));

const alarm = jest.mocked(ExpoAlarm);
const storage = jest.mocked(Storage);
const { ONE, THREE } = EMERGENCY_QUIET_ALLOWANCE;

const NOW = new Date(2026, 10, 21, 5).getTime();
const SPENT: QuietLedger = recordUse(NEW_QUIET_LEDGER, NOW) ?? NEW_QUIET_LEDGER;
const saved = (state: unknown) => JSON.stringify({ state, version: 0 });

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  useEmergencyQuietStore.setState({ ledger: NEW_QUIET_LEDGER });
});

afterEach(() => jest.useRealTimers());

// The tests run in order: the first seeds the store, the rest read it.
describe("the emergency quiet count on Android", () => {
  it("seeds again on refresh while the first seed failed, counting nothing twice", () => {
    alarm.seedQuietLedger.mockReturnValueOnce(SPENT);
    useEmergencyQuietStore.getState().refresh();

    expect(alarm.seedQuietLedger).toHaveBeenLastCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.getQuietLedger).not.toHaveBeenCalled();
    expect(useEmergencyQuietStore.getState().ledger).toEqual(SPENT);
  });

  it("spends from the alarm database", () => {
    alarm.recordQuietUse.mockReturnValueOnce(SPENT);

    useEmergencyQuietStore.getState().recordUse(NOW);

    expect(alarm.recordQuietUse).toHaveBeenCalledWith(NOW);
    expect(useEmergencyQuietStore.getState().ledger).toEqual(SPENT);
  });

  it("throws, counting nothing, when the database has none left", () => {
    alarm.recordQuietUse.mockReturnValueOnce(null);

    expect(() => useEmergencyQuietStore.getState().recordUse(NOW)).toThrow();
    expect(useEmergencyQuietStore.getState().ledger).toBe(NEW_QUIET_LEDGER);
  });

  it("sets the allowance in the alarm database", () => {
    const raised = setAllowance(NEW_QUIET_LEDGER, THREE, NOW);
    alarm.setQuietAllowance.mockReturnValueOnce(raised);

    useEmergencyQuietStore.getState().setAllowance(THREE, NOW);

    expect(alarm.setQuietAllowance).toHaveBeenCalledWith(THREE, NOW);
    expect(useEmergencyQuietStore.getState().ledger).toEqual(raised);
  });

  it("keeps the ledger as it was when the database write fails", () => {
    const before = useEmergencyQuietStore.getState().ledger;
    alarm.setQuietAllowance.mockImplementationOnce(() => {
      throw new Error("database locked");
    });

    expect(() => useEmergencyQuietStore.getState().setAllowance(ONE, NOW)).not.toThrow();
    expect(useEmergencyQuietStore.getState().ledger).toBe(before);
  });

  it("seeds the database with the saved ledger, then takes its answer", async () => {
    const ledger = setAllowance(NEW_QUIET_LEDGER, ONE, NOW);
    const joined = recordUse(ledger, NOW);
    storage.getItem.mockResolvedValueOnce(saved({ ledger }));
    alarm.seedQuietLedger.mockReturnValueOnce(joined ?? ledger);

    await useEmergencyQuietStore.persist.rehydrate();

    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(ledger, NOW);
    expect(useEmergencyQuietStore.getState().ledger).toEqual(joined);
  });

  it("reads a use the overlay counted with the app away, once seeded", () => {
    alarm.getQuietLedger.mockReturnValueOnce(SPENT);

    useEmergencyQuietStore.getState().refresh();

    expect(alarm.seedQuietLedger).not.toHaveBeenCalled();
    expect(useEmergencyQuietStore.getState().ledger).toEqual(SPENT);
  });

  it("starts over from a malformed database answer", () => {
    alarm.getQuietLedger.mockReturnValueOnce({
      allowance: 9,
      raise: null,
      month: null,
      used: 0,
      lastWriteAt: null,
    });

    useEmergencyQuietStore.getState().refresh();

    expect(useEmergencyQuietStore.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });
});

// A store loaded afresh, whose seed at import has failed.
const freshStore = async (): Promise<typeof useEmergencyQuietStore> => {
  let store = useEmergencyQuietStore;
  jest.isolateModules(() => {
    // A static import hoists out of the callback; isolateModules needs a call-time require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require("@/stores/emergencyQuiet").useEmergencyQuietStore;
  });
  await store.persist.rehydrate();
  jest.clearAllMocks();
  return store;
};

describe("the emergency quiet count before a seed has worked", () => {
  it("reads nothing on refresh until the saved ledger is loaded", async () => {
    const store = await freshStore();
    jest.spyOn(store.persist, "hasHydrated").mockReturnValueOnce(false);

    store.getState().refresh();

    expect(alarm.seedQuietLedger).not.toHaveBeenCalled();
    expect(alarm.getQuietLedger).not.toHaveBeenCalled();
  });

  it("logs a failed read on refresh rather than throwing", async () => {
    const store = await freshStore();
    alarm.seedQuietLedger.mockReturnValueOnce(NEW_QUIET_LEDGER);
    store.getState().refresh();
    alarm.getQuietLedger.mockImplementationOnce(() => {
      throw new Error("database locked");
    });

    expect(() => store.getState().refresh()).not.toThrow();
    expect(store.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });

  it("refuses a use without spending from the database while the seed fails", async () => {
    const store = await freshStore();

    expect(() => store.getState().recordUse(NOW)).toThrow();
    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.recordQuietUse).not.toHaveBeenCalled();
    expect(store.getState().ledger).toEqual(NEW_QUIET_LEDGER);
  });

  it("keeps an allowance in the saved ledger alone while the seed fails", async () => {
    const store = await freshStore();

    store.getState().setAllowance(THREE, NOW);

    expect(alarm.setQuietAllowance).not.toHaveBeenCalled();
    expect(store.getState().ledger).toEqual(setAllowance(NEW_QUIET_LEDGER, THREE, NOW));
  });

  it("seeds before it spends", async () => {
    const store = await freshStore();
    alarm.seedQuietLedger.mockReturnValueOnce(NEW_QUIET_LEDGER);
    alarm.recordQuietUse.mockReturnValueOnce(SPENT);

    store.getState().recordUse(NOW);

    expect(alarm.seedQuietLedger).toHaveBeenCalledWith(NEW_QUIET_LEDGER, NOW);
    expect(alarm.recordQuietUse).toHaveBeenCalledWith(NOW);
    expect(store.getState().ledger).toEqual(SPENT);
  });
});

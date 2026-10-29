import { SQLiteStorage } from "expo-sqlite/kv-store";

import { KEPT_MAX, NOT_ASKED_MAX } from "@/constants/CityCheck";
import { CITY_CHECK_STORAGE_DB_NAME } from "@/constants/DB";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import type { PlaceMark } from "@/types/cityCheck";

let mockSaved: string | null = null;

jest.mock("expo-sqlite/kv-store", () => {
  const storage = {
    getItem: jest.fn(() => Promise.resolve(mockSaved)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  };
  return { __esModule: true, default: storage, SQLiteStorage: jest.fn(() => storage) };
});

const MockSQLiteStorage = jest.mocked(SQLiteStorage);
const MARK_STEP = 0.01;
const PHONE_ZONE = "Asia/Dubai";
const CHECK_AT = 1_000;

const memory = () => useCityCheckStore.getState().cityCheck;

const rehydrate = async (cityCheck: unknown) => {
  mockSaved = cityCheck === null ? null : JSON.stringify({ state: { cityCheck }, version: 0 });
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
  await useCityCheckStore.persist.rehydrate();
};

const markAt = (i: number): PlaceMark => ({ lat: 10 + i, lng: 40, at: i });
// Oldest first, as a record written by hand may be.
const marks = (count: number) => Array.from({ length: count }, (_, i) => markAt(i));

describe("city-check memory persistence", () => {
  beforeEach(() => useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY }));

  it("persists to its own database file", () =>
    expect(MockSQLiteStorage).toHaveBeenCalledWith(CITY_CHECK_STORAGE_DB_NAME));

  it("loads defaults when nothing is saved", async () => {
    await rehydrate(null);
    expect(memory()).toEqual(EMPTY_MEMORY);
  });

  it("drops malformed marks from a saved record", async () => {
    const good = markAt(1);
    await rehydrate({ ...EMPTY_MEMORY, kept: [{ lat: "x" }, { lat: 1, lng: 2 }, good] });
    expect(memory().kept).toEqual([good]);
  });

  it("reads a malformed check time and phone zone as null", async () => {
    await rehydrate({ ...EMPTY_MEMORY, lastCheckAt: "soon", lastPhoneZone: 3 });
    expect(memory().lastCheckAt).toBeNull();
    expect(memory().lastPhoneZone).toBeNull();
  });

  it("reads a list that is not an array as empty", async () => {
    await rehydrate({ ...EMPTY_MEMORY, kept: { lat: 1 }, notAsked: null });
    expect(memory().kept).toEqual([]);
    expect(memory().notAsked).toEqual([]);
  });

  it("keeps the newest 5 kept and 10 muted entries", async () => {
    await rehydrate({
      ...EMPTY_MEMORY,
      kept: marks(KEPT_MAX + 2),
      notAsked: marks(NOT_ASKED_MAX + 2),
    });
    expect(memory().kept).toHaveLength(KEPT_MAX);
    expect(memory().notAsked).toHaveLength(NOT_ASKED_MAX);
    expect(memory().kept).not.toContainEqual(markAt(0));
    expect(memory().kept[0]).toEqual(markAt(KEPT_MAX + 1));
    expect(memory().notAsked[0]).toEqual(markAt(NOT_ASKED_MAX + 1));
    expect(memory().notAsked).not.toContainEqual(markAt(0));
  });

  it("keeps a trip for a new point and replaces a matching one", () => {
    const m1 = markAt(1);
    const m1near = { ...m1, lng: m1.lng + MARK_STEP, at: 2 };
    useCityCheckStore.getState().keep(m1);
    useCityCheckStore.getState().keep(m1near);
    expect(memory().kept).toEqual([m1near]);
  });

  it("records the phone zone at the start and the time at the end of a check", () => {
    useCityCheckStore.getState().noteCheckStarted(PHONE_ZONE);
    useCityCheckStore.getState().noteCheckFinished(CHECK_AT);
    expect(memory()).toMatchObject({ lastPhoneZone: PHONE_ZONE, lastCheckAt: CHECK_AT });
    useCityCheckStore.getState().forgetLastCheck();
    expect(memory().lastCheckAt).toBeNull();
  });

  it("clears the whole memory", () => {
    useCityCheckStore.getState().keep(markAt(1));
    useCityCheckStore.getState().clearMemory();
    expect(memory()).toEqual(EMPTY_MEMORY);
  });
});

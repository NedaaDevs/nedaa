import { SQLiteStorage } from "expo-sqlite/kv-store";

import {
  CITY_CHECK_END,
  CONFIRM_FIX_DELAY_MS,
  KEPT_MAX,
  KEPT_MAX_AGE_MS,
  NOT_ASKED_MAX,
} from "@/constants/CityCheck";
import { CITY_CHECK_STORAGE_DB_NAME } from "@/constants/DB";
import { FIX_SOURCE } from "@/constants/Location";
import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { ASR_SCHOOL } from "@/constants/providers";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { CityCheckFacts, CityCheckFix, PlaceMark } from "@/types/cityCheck";
import { judgeCityChange } from "@/utils/cityCheck/judge";
import { toPlaceMark } from "@/utils/cityCheck/marks";

let mockSaved: string | null = null;

const mockExcludeFromBackup = jest.fn();

jest.mock("@/utils/cityCheck/backupExclusion", () => ({
  excludeCityCheckFromBackup: () => mockExcludeFromBackup(),
}));

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

const NOW = 10 * KEPT_MAX_AGE_MS;
const LIVE_MS = KEPT_MAX_AGE_MS / 2;

// Made within the kept window, later marks later.
const markAt = (i: number): PlaceMark => ({ lat: 10 + i, lng: 40, at: NOW - LIVE_MS + i });
// Oldest first, as a record written by hand may be.
const marks = (count: number) => Array.from({ length: count }, (_, i) => markAt(i));

describe("city-check memory persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
  });
  afterEach(() => jest.useRealTimers());

  it("persists to its own database file", () =>
    expect(MockSQLiteStorage).toHaveBeenCalledWith(CITY_CHECK_STORAGE_DB_NAME));

  it("flags its file out of backup once the file is read", async () => {
    mockExcludeFromBackup.mockClear();

    await rehydrate(null);

    expect(mockExcludeFromBackup).toHaveBeenCalledTimes(1);
  });

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

  it("drops a kept mark older than the kept window on load", async () => {
    const live = markAt(1);
    const stale = { ...markAt(2), at: NOW - KEPT_MAX_AGE_MS - 1 };
    await rehydrate({ ...EMPTY_MEMORY, kept: [stale, live], notAsked: [stale] });
    expect(memory().kept).toEqual([live]);
    expect(memory().notAsked).toEqual([stale]);
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

  it("persists the muted list", () => {
    const mark = markAt(1);
    useCityCheckStore.getState().mute(mark);
    const saved = useCityCheckStore.persist.getOptions().partialize?.(useCityCheckStore.getState());
    expect(saved).toEqual({ cityCheck: expect.objectContaining({ notAsked: [mark] }) });
  });

  it("clears the whole memory", () => {
    useCityCheckStore.getState().keep(markAt(1));
    useCityCheckStore.getState().clearMemory();
    expect(memory()).toEqual(EMPTY_MEMORY);
  });
});

describe("asking again in a place", () => {
  const MAKKAH = { latitude: 21.4225, longitude: 39.8262 };
  const JEDDAH = { latitude: 21.5433, longitude: 39.1728 };
  const DUBAI = { latitude: 25.2, longitude: 55.27 };
  const UMM_AL_QURA_ID = 4;
  const FIX_ACCURACY_KM = 0.1;

  const fixAt = (fixedAt: number): CityCheckFix => ({
    point: JEDDAH,
    accuracyKm: FIX_ACCURACY_KM,
    fixedAt,
    source: FIX_SOURCE.FRESH,
  });
  // A confirmed fix pair in Jeddah, judged against the memory the store holds.
  const judged = () => {
    const { kept, notAsked } = memory();
    const facts: CityCheckFacts = {
      now: NOW,
      saved: {
        point: MAKKAH,
        accuracyKm: null,
        zone: RIYADH_ZONE,
        countryCode: COUNTRY_CODE.SAUDI_ARABIA,
      },
      fixes: [fixAt(NOW - CONFIRM_FIX_DELAY_MS), fixAt(NOW)],
      candidate: {
        point: JEDDAH,
        accuracyKm: FIX_ACCURACY_KM,
        fixedAt: NOW,
        zone: RIYADH_ZONE,
        countryCode: COUNTRY_CODE.SAUDI_ARABIA,
        name: null,
        distanceKm: 0,
      },
      countryLooked: false,
      methods: null,
      calc: { method: UMM_AL_QURA_ID, school: ASR_SCHOOL.SHAFI },
      kept,
      notAsked,
    };
    return judgeCityChange(facts);
  };

  it("clears the kept and not-asked marks at that point and no other", () => {
    const jeddah = toPlaceMark(JEDDAH, NOW);
    const dubai = toPlaceMark(DUBAI, NOW);
    useCityCheckStore.getState().keep(jeddah);
    useCityCheckStore.getState().keep(dubai);
    useCityCheckStore.getState().mute(jeddah);

    useCityCheckStore.getState().askAgainIn(jeddah);

    expect(memory().kept).toEqual([dubai]);
    expect(memory().notAsked).toEqual([]);
  });

  it("lets the next check offer the place again", () => {
    const jeddah = toPlaceMark(JEDDAH, NOW);
    useCityCheckStore.getState().keep(jeddah);
    useCityCheckStore.getState().mute(jeddah);
    expect(judged()).toMatchObject({ offer: false, reason: CITY_CHECK_END.NOT_ASKED });

    useCityCheckStore.getState().askAgainIn(jeddah);

    expect(judged().offer).toBe(true);
  });
});

import {
  getUnseenEntries,
  WHATS_NEW_ENTRIES,
  WhatsNewId,
  ALL_WHATS_NEW_IDS,
} from "@/constants/WhatsNew";
import { usePreferencesStore } from "@/stores/preferences";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const LOCKED_CTX = { quranUnlocked: false, umrahInProgress: false };

describe("getUnseenEntries", () => {
  test("returns nothing when every id is seen", () => {
    expect(getUnseenEntries([...ALL_WHATS_NEW_IDS], LOCKED_CTX)).toEqual([]);
  });

  test("hides quran entries while the gate is locked", () => {
    const ids = getUnseenEntries([], LOCKED_CTX).map((e) => e.id);
    expect(ids).toEqual([WhatsNewId.IMPORTANT_DAYS, WhatsNewId.UMRAH]);
  });

  test("shows quran entries first once unlocked", () => {
    const ids = getUnseenEntries([], { ...LOCKED_CTX, quranUnlocked: true }).map((e) => e.id);
    expect(ids).toEqual([
      WhatsNewId.QURAN_AUDIO,
      WhatsNewId.QURAN,
      WhatsNewId.IMPORTANT_DAYS,
      WhatsNewId.UMRAH,
    ]);
  });

  test("hides umrah entry when a guide session is in progress", () => {
    const ids = getUnseenEntries([], { ...LOCKED_CTX, umrahInProgress: true }).map((e) => e.id);
    expect(ids).toEqual([WhatsNewId.IMPORTANT_DAYS]);
  });

  test("filters only seen ids, keeping registry order", () => {
    const ids = getUnseenEntries([WhatsNewId.IMPORTANT_DAYS], LOCKED_CTX).map((e) => e.id);
    expect(ids).toEqual([WhatsNewId.UMRAH]);
  });
});

describe("important-days optIn action", () => {
  test("enable() turns the Home rotator on and isEnabled() reflects it", () => {
    const entry = WHATS_NEW_ENTRIES.find((e) => e.id === WhatsNewId.IMPORTANT_DAYS)!;
    if (entry.action.type !== "optIn") throw new Error("expected optIn action");

    usePreferencesStore.setState({ showImportantDaysOnHome: false });
    expect(entry.action.isEnabled()).toBe(false);

    entry.action.enable();
    expect(usePreferencesStore.getState().showImportantDaysOnHome).toBe(true);
    expect(entry.action.isEnabled()).toBe(true);
  });
});

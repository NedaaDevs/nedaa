import {
  getApplicableEntries,
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

// A settled text-size offer at normal OS scale keeps that entry out of these cases.
const BASE_CTX = {
  umrahInProgress: false,
  fontScale: 1.0,
  textSizeOfferHandled: true,
};

describe("getUnseenEntries", () => {
  test("returns nothing when every id is seen", () => {
    expect(getUnseenEntries([...ALL_WHATS_NEW_IDS], BASE_CTX)).toEqual([]);
  });

  test("lists the quran entries first", () => {
    const ids = getUnseenEntries([], BASE_CTX).map((e) => e.id);
    expect(ids).toEqual([
      WhatsNewId.QURAN_AUDIO,
      WhatsNewId.QURAN,
      WhatsNewId.IMPORTANT_DAYS,
      WhatsNewId.UMRAH,
    ]);
  });

  test("hides umrah entry when a guide session is in progress", () => {
    const ids = getUnseenEntries([], { ...BASE_CTX, umrahInProgress: true }).map((e) => e.id);
    expect(ids).toEqual([WhatsNewId.QURAN_AUDIO, WhatsNewId.QURAN, WhatsNewId.IMPORTANT_DAYS]);
  });

  test("filters only seen ids, keeping registry order", () => {
    const ids = getUnseenEntries([WhatsNewId.IMPORTANT_DAYS], BASE_CTX).map((e) => e.id);
    expect(ids).toEqual([WhatsNewId.QURAN_AUDIO, WhatsNewId.QURAN, WhatsNewId.UMRAH]);
  });
});

describe("getApplicableEntries", () => {
  test("lists seen entries, so the Settings sheet is never empty", () => {
    const ids = getApplicableEntries(BASE_CTX, WHATS_NEW_ENTRIES).map((e) => e.id);
    expect(ids).toEqual([
      WhatsNewId.QURAN_AUDIO,
      WhatsNewId.QURAN,
      WhatsNewId.IMPORTANT_DAYS,
      WhatsNewId.UMRAH,
    ]);
  });

  test("keeps the umrah entry while a guide session is in progress", () => {
    const ids = getApplicableEntries({ ...BASE_CTX, umrahInProgress: true }).map((e) => e.id);
    expect(ids).toContain(WhatsNewId.UMRAH);
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

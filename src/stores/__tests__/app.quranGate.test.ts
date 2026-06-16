import { useAppStore } from "@/stores/app";

// TODO(quran-gate): remove at 2.10.0
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

// TODO(quran-gate): remove at 2.10.0
describe("app store quran gate", () => {
  test("defaults to locked", () => {
    expect(useAppStore.getState().quranUnlocked).toBe(false);
  });

  test("setQuranUnlocked(true) unlocks", () => {
    useAppStore.getState().setQuranUnlocked(true);
    expect(useAppStore.getState().quranUnlocked).toBe(true);
  });

  test("setQuranUnlocked(false) re-locks", () => {
    useAppStore.getState().setQuranUnlocked(true);
    useAppStore.getState().setQuranUnlocked(false);
    expect(useAppStore.getState().quranUnlocked).toBe(false);
  });
});

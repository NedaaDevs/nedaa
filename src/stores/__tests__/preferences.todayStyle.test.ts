import Storage from "expo-sqlite/kv-store";

import { TODAY_STYLE } from "@/constants/Today";
import { usePreferencesStore } from "@/stores/preferences";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const STORE_KEY = "display-storage";

describe("preferences Today style", () => {
  it("draws the bowl by default", () => {
    expect(usePreferencesStore.getState().todayStyle).toBe(TODAY_STYLE.BOWL);
  });

  it("stores the style chosen", () => {
    usePreferencesStore.getState().setTodayStyle(TODAY_STYLE.SIMPLE);

    expect(usePreferencesStore.getState().todayStyle).toBe(TODAY_STYLE.SIMPLE);
  });

  // Preferences saved before the setting existed carry no style.
  it("reads the bowl from saved preferences that name no style", async () => {
    usePreferencesStore.setState({ todayStyle: TODAY_STYLE.BOWL });
    jest
      .mocked(Storage.getItem)
      .mockImplementation((key) =>
        Promise.resolve(
          key === STORE_KEY ? JSON.stringify({ state: { showSeconds: false }, version: 0 }) : null
        )
      );

    await usePreferencesStore.persist.rehydrate();

    expect(usePreferencesStore.getState().showSeconds).toBe(false);
    expect(usePreferencesStore.getState().todayStyle).toBe(TODAY_STYLE.BOWL);
  });

  it("keeps a saved style", async () => {
    jest
      .mocked(Storage.getItem)
      .mockImplementation((key) =>
        Promise.resolve(
          key === STORE_KEY
            ? JSON.stringify({ state: { todayStyle: TODAY_STYLE.SIMPLE }, version: 0 })
            : null
        )
      );

    await usePreferencesStore.persist.rehydrate();

    expect(usePreferencesStore.getState().todayStyle).toBe(TODAY_STYLE.SIMPLE);
  });
});

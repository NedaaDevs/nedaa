import { useProviderSettingsStore } from "@/stores/providerSettings";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("provider settings apply lifecycle", () => {
  beforeEach(() => {
    useProviderSettingsStore.setState({ isModified: false, error: null });
  });

  test("saveSettings leaves the dirty flag set for the caller to clear", async () => {
    useProviderSettingsStore.getState().updateCurrentSettings({ method: 5 });

    await useProviderSettingsStore.getState().saveSettings();

    expect(useProviderSettingsStore.getState().isModified).toBe(true);
  });

  test("markSettingsApplied clears the dirty flag", () => {
    useProviderSettingsStore.getState().updateCurrentSettings({ method: 5 });

    useProviderSettingsStore.getState().markSettingsApplied();

    expect(useProviderSettingsStore.getState().isModified).toBe(false);
  });

  test("saveSettings still persists the edit it was given", async () => {
    useProviderSettingsStore.getState().updateCurrentSettings({ method: 5 });

    await useProviderSettingsStore.getState().saveSettings();

    expect(useProviderSettingsStore.getState().getCurrentSettings()).toMatchObject({ method: 5 });
  });
});

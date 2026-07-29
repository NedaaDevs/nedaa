import {
  awaitPendingReapply,
  migrateProviderSettings,
  useProviderSettingsStore,
} from "@/stores/providerSettings";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("provider settings reapply migration", () => {
  test("flags a reapply for installs persisted at version 1", () => {
    const migrated = migrateProviderSettings(
      { currentProviderId: "aladhan", allSettings: { aladhan: { method: 4 } } },
      1
    );

    expect(migrated.pendingReapply).toBe(true);
  });

  test("flags a reapply for installs persisted at version 0", () => {
    const migrated = migrateProviderSettings(
      { currentProviderId: 1, allSettings: { "1": { method: 4 } } },
      0
    );

    expect(migrated.pendingReapply).toBe(true);
  });

  test("still remaps legacy numeric provider ids from version 0", () => {
    const migrated = migrateProviderSettings(
      { currentProviderId: 1, allSettings: { "1": { method: 4 } } },
      0
    );

    expect(migrated.currentProviderId).toBe("aladhan");
    expect(migrated.allSettings).toEqual({ aladhan: { method: 4 } });
  });

  test("preserves the persisted settings it was given", () => {
    const migrated = migrateProviderSettings(
      { currentProviderId: "aladhan", allSettings: { aladhan: { method: 4, madhab: 1 } } },
      1
    );

    expect(migrated.allSettings).toEqual({ aladhan: { method: 4, madhab: 1 } });
  });

  test("a fresh install does not request a reapply", () => {
    expect(useProviderSettingsStore.getState().pendingReapply).toBe(false);
  });

  test("clearPendingReapply turns the flag off", () => {
    useProviderSettingsStore.setState({ pendingReapply: true });

    useProviderSettingsStore.getState().clearPendingReapply();

    expect(useProviderSettingsStore.getState().pendingReapply).toBe(false);
  });
});

describe("awaitPendingReapply", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useProviderSettingsStore.setState({ pendingReapply: false });
  });

  test("reports the migrated flag rather than the pre-hydration default", async () => {
    let finishHydration: (() => void) | undefined;
    jest.spyOn(useProviderSettingsStore.persist, "hasHydrated").mockReturnValue(false);
    jest.spyOn(useProviderSettingsStore.persist, "onFinishHydration").mockImplementation((fn) => {
      finishHydration = () => fn(useProviderSettingsStore.getState());
      return () => {};
    });

    const pending = awaitPendingReapply();
    useProviderSettingsStore.setState({ pendingReapply: true });
    finishHydration?.();

    await expect(pending).resolves.toBe(true);
  });

  test("reports the flag immediately when already hydrated", async () => {
    jest.spyOn(useProviderSettingsStore.persist, "hasHydrated").mockReturnValue(true);
    useProviderSettingsStore.setState({ pendingReapply: true });

    await expect(awaitPendingReapply()).resolves.toBe(true);
  });
});

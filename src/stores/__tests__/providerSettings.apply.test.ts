import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const store = () => useProviderSettingsStore.getState();

describe("provider settings draft and apply", () => {
  beforeEach(() => {
    store().selectProviderById(PRAYER_TIME_PROVIDERS.ALADHAN.id);
    store().markSettingsApplied();
    useProviderSettingsStore.setState({ pendingReapply: false, error: null });
  });

  // The fetch reads the applied settings; an edit reaches it only on Apply.
  test("an edit stays in the draft until it is applied", () => {
    const applied = store().getCurrentSettings();

    store().updateCurrentSettings({ method: 5 });

    expect(store().getCurrentSettings()).toEqual(applied);
    expect(store().getDraftSettings()).toMatchObject({ method: 5 });
    expect(store().isModified).toBe(true);
  });

  test("an edit alone requests no refetch at the next launch", () => {
    store().updateCurrentSettings({ method: 5 });

    expect(store().pendingReapply).toBe(false);
  });

  test("saving promotes the draft and requests a refetch until the times land", async () => {
    store().updateCurrentSettings({ method: 5 });

    await store().saveSettings();

    expect(store().getCurrentSettings()).toMatchObject({ method: 5 });
    expect(store().pendingReapply).toBe(true);
    // Still dirty: a failed fetch after the save leaves the change to retry.
    expect(store().isModified).toBe(true);
  });

  test("marking the change applied clears the draft and the refetch request", async () => {
    store().updateCurrentSettings({ method: 5 });
    await store().saveSettings();

    store().markSettingsApplied();

    expect(store().isModified).toBe(false);
    expect(store().pendingReapply).toBe(false);
    expect(store().getDraftSettings()).toEqual(store().getCurrentSettings());
  });

  test("never writes the draft to disk", () => {
    store().updateCurrentSettings({ method: 5 });

    const persisted = useProviderSettingsStore.persist.getOptions().partialize?.(store());

    expect(persisted).not.toHaveProperty("draft");
    expect(persisted).not.toHaveProperty("isModified");
  });

  test("switching provider drops an unapplied draft", () => {
    store().updateCurrentSettings({ method: 5 });

    store().selectProviderById(PRAYER_TIME_PROVIDERS.ALADHAN.id);

    expect(store().isModified).toBe(false);
    expect(store().getDraftSettings()).toEqual(store().getCurrentSettings());
  });
});

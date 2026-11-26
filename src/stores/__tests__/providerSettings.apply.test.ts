import { ASR_SCHOOL, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const store = () => useProviderSettingsStore.getState();

describe("provider settings draft and apply", () => {
  beforeEach(() => {
    store().selectProviderById(PRAYER_TIME_PROVIDERS.ALADHAN.id);
    useProviderSettingsStore.setState({
      draft: null,
      isModified: false,
      pendingReapply: false,
      error: null,
      applying: false,
      applyStep: null,
    });
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
    const saved = await store().saveSettings();

    store().markSettingsApplied(saved);

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

  // An edit made while the times load is a newer draft, not the one applied.
  test("keeps an edit made after the save once the saved one lands", async () => {
    store().updateCurrentSettings({ method: 5 });
    const saved = await store().saveSettings();
    store().updateCurrentSettings({ madhab: ASR_SCHOOL.HANAFI });

    store().markSettingsApplied(saved);

    expect(store().isModified).toBe(true);
    expect(store().pendingReapply).toBe(false);
    expect(store().getDraftSettings()).toMatchObject({ method: 5, madhab: ASR_SCHOOL.HANAFI });
  });

  test("an edit back to the applied settings leaves nothing to apply", () => {
    const applied = store().getCurrentSettings();
    store().updateCurrentSettings({ method: 5 });

    store().updateCurrentSettings({ method: applied?.method });

    expect(store().isModified).toBe(false);
    expect(store().draft).toBeNull();
  });

  // The saved settings have not reached the times yet, so Apply stays offered.
  test("an edit back to saved settings keeps Apply while a refetch is owed", async () => {
    store().updateCurrentSettings({ method: 5 });
    await store().saveSettings();
    useProviderSettingsStore.setState({ draft: null, isModified: false });

    store().updateCurrentSettings({ method: 4 });
    store().updateCurrentSettings({ method: 5 });

    expect(store().isModified).toBe(true);
  });

  test("an adjustment moved and moved back leaves nothing to apply", () => {
    const tuning = PRAYER_TIME_PROVIDERS.ALADHAN.tuning;

    store().updateCurrentSettings({ tune: { ...tuning, fajr: 1 } });
    store().updateCurrentSettings({ tune: { ...tuning, fajr: 0 } });

    expect(store().isModified).toBe(false);
  });

  test("runs one apply at a time and drops its step after", async () => {
    let finish!: () => void;
    const steps: (string | null)[] = [];
    const first = store().runApply(async (onStep) => {
      onStep("prayerTimes");
      steps.push(store().applyStep);
      await new Promise<void>((resolve) => (finish = resolve));
    });
    const second = jest.fn(() => Promise.resolve());

    await expect(store().runApply(second)).resolves.toBe(false);
    expect(store().applying).toBe(true);
    finish();

    await expect(first).resolves.toBe(true);
    expect(second).not.toHaveBeenCalled();
    expect(steps).toEqual(["prayerTimes"]);
    expect(store().applying).toBe(false);
    expect(store().applyStep).toBeNull();
  });

  test("releases the apply when a step throws", async () => {
    await expect(store().runApply(() => Promise.reject(new Error("offline")))).rejects.toThrow(
      "offline"
    );

    expect(store().applying).toBe(false);
  });

  describe("discarding the draft", () => {
    beforeEach(() => {
      // Earlier tests apply settings; start from a known method.
      useProviderSettingsStore.setState({
        allSettings: { [PRAYER_TIME_PROVIDERS.ALADHAN.id]: { method: 2 } },
      });
      store().updateCurrentSettings({ method: 3 });
      expect(store().isModified).toBe(true);
    });

    test("leaves the applied settings as they were", () => {
      useProviderSettingsStore.setState({ error: "stale" });

      store().discardDraft();

      expect(store().draft).toBeNull();
      expect(store().isModified).toBe(false);
      expect(store().error).toBeNull();
      expect(store().getCurrentSettings()).toEqual({ method: 2 });
      expect(store().getDraftSettings()).toEqual({ method: 2 });
    });

    // The running apply saves the draft; dropping it would lose that change.
    test("keeps the draft while an apply runs", () => {
      useProviderSettingsStore.setState({ applying: true });

      store().discardDraft();

      expect(store().getDraftSettings()).toMatchObject({ method: 3 });
      expect(store().isModified).toBe(true);
    });
  });
});

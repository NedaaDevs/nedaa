/**
 * The steps that carry a saved provider setting to the user. Named to match the
 * `location.update.step.*` copy, which describes the same work.
 */
export type ApplyStep = "prayerTimes" | "notifications" | "alarms";

export type ApplyProviderSettingsDeps<Saved> = {
  saveSettings: () => Promise<Saved>;
  /** Resolves false while a year it fetched is still owed. */
  loadPrayerTimes: (forceGetAndStore: boolean) => Promise<boolean>;
  // Result intentionally unused here; the apply flow only needs completion.
  scheduleAllNotifications: () => Promise<unknown>;
  rescheduleAllAlarms: () => Promise<void>;
  reloadPrayerWidgets: () => void;
  markSettingsApplied: (saved: Saved) => void;
};

/**
 * Every step must succeed before the edit counts as applied. Throws on the first
 * failure, leaving the settings dirty for a retry; resolves whether it applied.
 */
export const applyProviderSettings = async <Saved>(
  deps: ApplyProviderSettingsDeps<Saved>,
  onStep: (step: ApplyStep) => void
): Promise<boolean> => {
  const saved = await deps.saveSettings();

  onStep("prayerTimes");
  const landed = await deps.loadPrayerTimes(true);

  onStep("notifications");
  await deps.scheduleAllNotifications();

  onStep("alarms");
  await deps.rescheduleAllAlarms();

  deps.reloadPrayerWidgets();

  // A year the load still owes keeps the edit pending for a later load.
  if (landed) deps.markSettingsApplied(saved);
  return landed;
};

/**
 * The steps that carry a saved provider setting to the user. Named to match the
 * `location.update.step.*` copy, which describes the same work.
 */
export type ApplyStep = "prayerTimes" | "notifications" | "alarms";

export type ApplyProviderSettingsDeps = {
  saveSettings: () => Promise<void>;
  loadPrayerTimes: (forceGetAndStore: boolean) => Promise<void>;
  scheduleAllNotifications: () => Promise<void>;
  rescheduleAllAlarms: () => Promise<void>;
  reloadPrayerWidgets: () => void;
  markSettingsApplied: () => void;
};

/**
 * A setting only reaches the user once the times are refetched with it and everything
 * downstream is rescheduled, so the whole run has to succeed before the edit counts as
 * applied. Throws the first step's failure, leaving the settings dirty for a retry.
 */
export const applyProviderSettings = async (
  deps: ApplyProviderSettingsDeps,
  onStep: (step: ApplyStep) => void
): Promise<void> => {
  await deps.saveSettings();

  onStep("prayerTimes");
  await deps.loadPrayerTimes(true);

  onStep("notifications");
  await deps.scheduleAllNotifications();

  onStep("alarms");
  await deps.rescheduleAllAlarms();

  deps.reloadPrayerWidgets();

  deps.markSettingsApplied();
};

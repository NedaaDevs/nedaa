import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

import { PRAYER_IDS } from "@/constants/Prayer";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { SETTINGS_ROW, type SettingsRowId } from "@/constants/SettingsRoot";
import { useAlarmStatus } from "@/hooks/useAlarmStatus";
import { usePlace } from "@/hooks/usePlace";
import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { getEffectiveConfig, type NotificationSettings } from "@/types/notification";
import { hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;

/** Which Athkar reminders are on, keyed morning then evening. */
const ATHKAR_SUMMARY: Record<`${boolean}-${boolean}`, ParseKeys> = {
  "false-false": "settings.summary.athkar.off",
  "true-false": "settings.summary.athkar.morning",
  "false-true": "settings.summary.athkar.evening",
  "true-true": "settings.summary.athkar.both",
};

/** How many of the five prayers alert, by any sound, once overrides apply. */
const alertCount = ({ defaults, overrides }: NotificationSettings) =>
  PRAYER_IDS.filter(
    (id) => getEffectiveConfig(id, NOTIFICATION_TYPE.PRAYER, defaults, overrides).enabled
  ).length;

/** Each root row's state now, as its row reads it; Widgets has none. */
export const useSettingsSummaries = (): Partial<Record<SettingsRowId, string>> => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const mode = useAppStore((state) => state.mode);
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);
  const use24Hour = usePreferencesStore((state) => state.use24HourTime);
  const textSize = usePreferencesStore((state) => state.textSize);
  const place = usePlace().name;
  const methodId = useProviderSettingsStore((state) =>
    state.currentProviderId === ALADHAN.id ? state.allSettings[ALADHAN.id]?.method : undefined
  );
  const notifications = useNotificationStore((state) => state.settings);
  const morning = useNotificationStore((state) => state.morningNotification.enabled);
  const evening = useNotificationStore((state) => state.eveningNotification.enabled);
  const alarmStatus = useAlarmStatus();

  const method = ALADHAN.methods.find(({ id }) => id === methodId);
  const alerts = alertCount(notifications);
  // The scheduler sends no reminder while notifications are off.
  const athkarOn = (enabled: boolean) => notifications.enabled && enabled;

  return {
    [SETTINGS_ROW.PREFERENCES]: t("settings.summary.preferences", {
      clock: t(use24Hour ? "settings.summary.clock24" : "settings.summary.clock12"),
      size: t(`settings.textSize.options.${textSize}`),
    }),
    [SETTINGS_ROW.APPEARANCE]: t(`settings.themes.${mode}.title`),
    [SETTINGS_ROW.LANGUAGE]: t(`settings.languages.${locale}.nativeTitle`),
    // The store always holds coordinates, so a place with no name has no summary.
    [SETTINGS_ROW.LOCATION]: place,
    [SETTINGS_ROW.CALCULATION]: method
      ? t(`providers.aladhan.methods.${method.nameKey}`)
      : t("settings.summary.methodAuto"),
    [SETTINGS_ROW.HIJRI]: hijriAdjustmentLabel(hijriOffset, t),
    [SETTINGS_ROW.NOTIFICATIONS]: !notifications.enabled
      ? t("settings.summary.notificationsOff")
      : alerts === PRAYER_IDS.length
        ? t("settings.summary.alertsAll")
        : t("settings.summary.alerts", { count: alerts }),
    [SETTINGS_ROW.ALARMS]: alarmStatus,
    [SETTINGS_ROW.ATHKAR]: t(ATHKAR_SUMMARY[`${athkarOn(morning)}-${athkarOn(evening)}`]),
    [SETTINGS_ROW.ABOUT]: t("settings.summary.about"),
  };
};

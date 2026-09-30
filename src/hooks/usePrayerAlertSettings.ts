import { NOTIFICATION_TYPE, PRAYER_NOTIFICATION_TYPES } from "@/constants/Notification";
import type { PrayerId } from "@/constants/Prayer";
import { useNotificationStore } from "@/stores/notification";
import {
  getEffectiveConfig,
  type ConfigForType,
  type PrayerNotificationType,
} from "@/types/notification";

export type PrayerAlertConfigs = { [T in PrayerNotificationType]: ConfigForType<T> };

export type PrayerAlertSettings = {
  /** Each type's defaults with this prayer's override on top. */
  configs: PrayerAlertConfigs;
  /** Whether any stored field of this prayer differs from its default. */
  isCustom: boolean;
  /** Sets one field for this prayer; the default value clears it instead. */
  update: <T extends PrayerNotificationType, K extends keyof ConfigForType<T>>(
    type: T,
    field: K,
    value: ConfigForType<T>[K]
  ) => Promise<void>;
  /** Drops every override of this prayer, so it follows the defaults again. */
  reset: () => Promise<void>;
};

// A default can move onto a stored value, so storing a field is not custom.
const differsFrom = (override: Record<string, unknown>, defaults: Record<string, unknown>) =>
  Object.entries(override).some(([field, value]) => defaults[field] !== value);

// Each write reschedules unless a useNotificationEditSession is open.
export const usePrayerAlertSettings = (prayerId: PrayerId): PrayerAlertSettings => {
  const defaults = useNotificationStore((state) => state.settings.defaults);
  const overrides = useNotificationStore((state) => state.settings.overrides);
  const updateOverride = useNotificationStore((state) => state.updateOverride);
  const resetOverride = useNotificationStore((state) => state.resetOverride);
  const withBatch = useNotificationStore((state) => state.withBatch);

  const configs = {
    [NOTIFICATION_TYPE.PRAYER]: getEffectiveConfig(
      prayerId,
      NOTIFICATION_TYPE.PRAYER,
      defaults,
      overrides
    ),
    [NOTIFICATION_TYPE.IQAMA]: getEffectiveConfig(
      prayerId,
      NOTIFICATION_TYPE.IQAMA,
      defaults,
      overrides
    ),
    [NOTIFICATION_TYPE.PRE_ATHAN]: getEffectiveConfig(
      prayerId,
      NOTIFICATION_TYPE.PRE_ATHAN,
      defaults,
      overrides
    ),
  } satisfies PrayerAlertConfigs;

  const isCustom = PRAYER_NOTIFICATION_TYPES.some((type) =>
    differsFrom(overrides[prayerId]?.[type] ?? {}, defaults[type])
  );

  return {
    configs,
    isCustom,
    update: (type, field, value) => updateOverride(prayerId, type, field, value),
    // One batch, so a reset costs one reschedule however many types it clears.
    reset: () =>
      withBatch(async () => {
        for (const type of PRAYER_NOTIFICATION_TYPES) {
          await resetOverride(prayerId, type);
        }
      }),
  };
};

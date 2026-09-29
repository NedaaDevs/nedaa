import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { openSettings } from "expo-linking";

// Utils
import { cancelAllScheduledNotifications } from "@/utils/notifications";
import { scheduleAllNotifications, shouldReschedule } from "@/utils/notificationScheduler";
import { buildUsedSoundsSet } from "@/utils/customSoundManager";
import { singleFlight } from "@/utils/singleFlight";

// Stores
import locationStore from "@/stores/location";
import prayerTimesStore from "@/stores/prayerTimes";
import { clearTransientSchedulingState } from "@/stores/notificationTransientState";

// Services
import { QadaDB } from "@/services/qada-db";

// Types
import {
  AthkarNotificationSettings,
  ConfigForType,
  getEffectiveConfig,
  type NotificationAction,
  type NotificationSettings,
  type PrayerNotificationType,
  type NotificationState,
  type OtherTimingId,
  type OtherTimingNotifications,
  type DuhaTimePreference,
  type SchedulingResult,
} from "@/types/notification";
import { OTHER_TIMING } from "@/constants/Prayer";
import { SchedulingSkipReason } from "@/enums/notifications";
import { Platform } from "react-native";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { PlatformType } from "@/enums/app";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("notifications");

export type NotificationStore = NotificationState & NotificationAction;

// Seats a config at overrides[prayerId][type]. What the caller resolves into `config`
// is what distinguishes a merging write from a replacing one.
const writeOverride = <T extends PrayerNotificationType>(
  settings: NotificationSettings,
  prayerId: string,
  type: T,
  config: Partial<ConfigForType<T>>
): NotificationSettings => ({
  ...settings,
  overrides: {
    ...settings.overrides,
    [prayerId]: { ...settings.overrides[prayerId], [type]: config },
  },
});

const removeOverride = (
  settings: NotificationSettings,
  prayerId: string,
  type: PrayerNotificationType
): NotificationSettings => {
  const remainingTypes = { ...settings.overrides[prayerId] };
  delete remainingTypes[type];

  const overrides = { ...settings.overrides };

  // A prayer whose last overridden type is gone leaves no entry behind.
  if (Object.keys(remainingTypes).length > 0) {
    overrides[prayerId] = remainingTypes;
  } else {
    delete overrides[prayerId];
  }

  return { ...settings, overrides };
};

// Debts recorded so far; a run settles the debt only if none arrived since.
let debtsRecorded = 0;

// Runs the scheduler and clears the debt it covered.
const rescheduleAndSettle = async (
  get: () => NotificationStore,
  set: (partial: Pick<NotificationStore, "pendingReschedule">) => void
): Promise<void> => {
  const debtsBefore = debtsRecorded;
  const result = await get().scheduleAllNotifications();
  if (result.success && debtsRecorded === debtsBefore && get().pendingReschedule) {
    set({ pendingReschedule: false });
  }
};

const defaultSettings: NotificationSettings = {
  enabled: true,
  defaults: {
    prayer: {
      enabled: true,
      sound: "makkahAthan1",
      vibration: true,
    },
    iqama: {
      enabled: false,
      sound: "iqama1",
      vibration: true,
      timing: 10,
    },
    preAthan: {
      enabled: false,
      sound: "tasbih",
      vibration: false,
      timing: 15,
    },
    qada: {
      enabled: false,
      sound: "tasbih",
      vibration: true,
    },
  },
  overrides: {
    // Set Maghrib iqama to 5 minutes by default
    maghrib: {
      iqama: {
        timing: 5,
      },
    },
  },
};

const defaultOtherTimingNotifications: OtherTimingNotifications = {
  [OTHER_TIMING.ISHRAQ]: false,
  [OTHER_TIMING.DUHA]: false,
  [OTHER_TIMING.MIDNIGHT]: false,
  [OTHER_TIMING.FIRST_THIRD]: false,
  [OTHER_TIMING.LAST_THIRD]: false,
  [OTHER_TIMING.IMSAK]: false,
};

const defaultDuhaTime: DuhaTimePreference = {
  hour: 9,
  minute: 0,
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set, get) => ({
        settings: defaultSettings,
        isScheduling: false,
        batchDepth: 0,
        pendingReschedule: false,
        lastScheduledDate: null,
        migrationVersion: 0,
        morningNotification: {
          type: ATHKAR_TYPE.MORNING,
          enabled: false,
          hour: 6, // AM
          minute: 0,
        },
        eveningNotification: {
          type: ATHKAR_TYPE.EVENING,
          enabled: false,
          hour: 12, // PM
          minute: 0,
        },
        fullAthanPlayback: false,
        athanAudioStream: "media" as const,
        fullIqamaPlayback: false,
        iqamaAudioStream: "media" as const,
        otherTimingNotifications: defaultOtherTimingNotifications,
        duhaTime: defaultDuhaTime,

        updateOtherTimingNotification: async (id: OtherTimingId, enabled: boolean) => {
          set((state) => ({
            otherTimingNotifications: {
              ...state.otherTimingNotifications,
              [id]: enabled,
            },
          }));
          await get().requestReschedule();
        },

        updateDuhaTime: async (hour: number, minute: number) => {
          set({ duhaTime: { hour, minute } });
          if (get().otherTimingNotifications.duha) {
            await get().requestReschedule();
          }
        },

        updateFullAthanPlayback: async (enabled) => {
          set({ fullAthanPlayback: enabled });
          await get().requestReschedule();
        },

        updateAthanAudioStream: async (stream) => {
          set({ athanAudioStream: stream });
          if (Platform.OS === PlatformType.ANDROID) {
            const { setAthanAudioStream } = await import("expo-alarm");
            setAthanAudioStream(stream);
          }
        },

        updateFullIqamaPlayback: async (enabled) => {
          set({ fullIqamaPlayback: enabled });
          await get().requestReschedule();
        },

        updateIqamaAudioStream: async (stream) => {
          set({ iqamaAudioStream: stream });
          if (Platform.OS === PlatformType.ANDROID) {
            const { setIqamaAudioStream } = await import("expo-alarm");
            setIqamaAudioStream(stream);
          }
        },

        updateAllNotificationToggle: async (enabled) => {
          set((state) => ({
            settings: { ...state.settings, enabled },
          }));

          // If disabling, cancel all notifications
          if (!enabled) {
            await cancelAllScheduledNotifications();
          } else {
            await get().requestReschedule();
          }
        },

        updateQuickSetup: async (sound, vibration) => {
          set((state) => ({
            settings: {
              ...state.settings,
              defaults: {
                ...state.settings.defaults,
                prayer: {
                  ...state.settings.defaults.prayer,
                  sound,
                  vibration,
                },
              },
            },
          }));

          await get().requestReschedule();
        },

        updateDefault: async (type, field, value) => {
          set((state) => ({
            settings: {
              ...state.settings,
              defaults: {
                ...state.settings.defaults,
                [type]: { ...state.settings.defaults[type], [field]: value },
              },
            },
          }));

          await get().requestReschedule();
        },

        updateOverride: async <T extends PrayerNotificationType, K extends keyof ConfigForType<T>>(
          prayerId: string,
          type: T,
          field: K,
          value: ConfigForType<T>[K]
        ) => {
          const { settings } = get();
          const stored: Partial<ConfigForType<T>> = settings.overrides[prayerId]?.[type] ?? {};
          // A value equal to the default is no override, so the field is dropped.
          const isDefault = settings.defaults[type][field] === value;
          if (isDefault ? stored[field] === undefined : stored[field] === value) return;

          const config: Partial<ConfigForType<T>> = { ...stored };
          if (isDefault) {
            delete config[field];
          } else {
            config[field] = value;
          }

          set((state) => ({
            settings:
              Object.keys(config).length > 0
                ? writeOverride(state.settings, prayerId, type, config)
                : removeOverride(state.settings, prayerId, type),
          }));

          await get().requestReschedule();
        },

        replaceOverride: async (prayerId, type, config) => {
          // A config that keeps no field leaves nothing to override.
          if (Object.keys(config).length === 0) {
            await get().resetOverride(prayerId, type);
            return;
          }

          set((state) => ({
            settings: writeOverride(state.settings, prayerId, type, config),
          }));

          await get().requestReschedule();
        },

        resetOverride: async (prayerId, type) => {
          // Nothing stored means nothing changes, so nothing is owed.
          if (get().settings.overrides[prayerId]?.[type] === undefined) return;

          set((state) => ({ settings: removeOverride(state.settings, prayerId, type) }));

          await get().requestReschedule();
        },

        resetAllOverrides: async () => {
          set((state) => ({
            settings: { ...state.settings, overrides: {} },
          }));
          await get().requestReschedule();
        },

        withBatch: async (run) => {
          set((state) => ({ batchDepth: state.batchDepth + 1 }));

          try {
            return await run();
          } finally {
            const depth = Math.max(0, get().batchDepth - 1);
            set({ batchDepth: depth });

            // Only the outermost batch pays, and only for writes that happened. The debt
            // is cleared once the scheduler confirms, not before: a failed run has
            // already cancelled everything, so the work is still owed.
            if (depth === 0 && get().pendingReschedule) {
              await rescheduleAndSettle(get, set);
            }
          }
        },

        requestReschedule: async () => {
          if (get().batchDepth > 0) {
            debtsRecorded += 1;
            set({ pendingReschedule: true });
            return;
          }

          // A full reschedule covers whatever a previous failed flush still owed.
          await rescheduleAndSettle(get, set);
        },

        // Runs cancel and rebuild every notification; two at once can duplicate them.
        scheduleAllNotifications: singleFlight(async (): Promise<SchedulingResult> => {
          const {
            settings,
            morningNotification,
            eveningNotification,
            fullAthanPlayback,
            fullIqamaPlayback,
            otherTimingNotifications,
            duhaTime,
          } = get();
          if (!settings.enabled) {
            return {
              success: true,
              scheduledCount: 0,
              skipReason: SchedulingSkipReason.NOTIFICATIONS_DISABLED,
            };
          }

          set({ isScheduling: true });

          try {
            const timezone = locationStore.getState().locationDetails.timezone;

            // Get two weeks worth of prayer data
            const prayersData = prayerTimesStore.getState().twoWeeksTimings;

            // Get qada settings and remaining count
            let qadaData = null;
            try {
              const qadaSettings = await QadaDB.getSettings();
              const qadaRemainingCount = await QadaDB.getRemainingCount();
              if (qadaSettings) {
                qadaData = {
                  settings: qadaSettings,
                  remainingCount: qadaRemainingCount,
                };
              }
            } catch (error) {
              console.warn("[Notification Store] Failed to load qada data:", error);
            }

            const result = await scheduleAllNotifications(
              settings,
              {
                morningNotification,
                eveningNotification,
              },
              prayersData,
              timezone,
              qadaData,
              { fullAthanPlayback, fullIqamaPlayback },
              {},
              otherTimingNotifications,
              duhaTime
            );

            if (result.success) {
              set({ lastScheduledDate: new Date().toISOString() });
              console.log(`Scheduled ${result.scheduledCount} notifications`);
            } else if (result.skipReason) {
              console.warn(`[Notification Store] Nothing scheduled: ${result.skipReason}`);
            } else {
              console.error("Failed to schedule notifications:", result.error);
            }
            return result;
          } finally {
            set({ isScheduling: false });
          }
        }),

        rescheduleIfNeeded: async (force = false) => {
          const { settings, isScheduling } = get();

          if (!settings.enabled || isScheduling) return;

          if (shouldReschedule(get().lastScheduledDate, force)) {
            await get().scheduleAllNotifications();
          }
        },

        updateAthkarNotificationSetting: async (option: AthkarNotificationSettings) => {
          const key =
            option.type === ATHKAR_TYPE.MORNING ? "morningNotification" : "eveningNotification";
          set({
            [key]: {
              ...get()[key],
              ...option,
            },
          });

          await get().requestReschedule();
        },

        getEffectiveConfigForPrayer: <T extends PrayerNotificationType>(
          prayerId: string,
          type: T
        ): ConfigForType<T> => {
          const { settings } = get();
          return getEffectiveConfig(prayerId, type, settings.defaults, settings.overrides);
        },
        updateSettings: async (newSettings: NotificationSettings) => {
          set({ settings: newSettings });
          await get().requestReschedule();
        },

        getUsedCustomSounds: () => {
          const { settings } = get();
          return buildUsedSoundsSet(settings);
        },

        openNotificationSettings: async () => {
          try {
            await openSettings();
          } catch (error) {
            console.error("Failed to open settings:", error);
          }
        },
      }),
      {
        name: "notification-storage",
        storage: createJSONStorage(() => Storage),
        onRehydrateStorage: () => (state) => {
          if (!state) return;

          clearTransientSchedulingState(state);

          // Migration v1: Add qada defaults for old users
          if (state.migrationVersion < 1) {
            if (!state.settings?.defaults?.qada) {
              state.settings = state.settings || { ...defaultSettings };
              state.settings.defaults = state.settings.defaults || {};
              state.settings.defaults.qada = {
                enabled: false,
                sound: "tasbih",
                vibration: true,
              };
              log.i("Store", "migration v1: added qada defaults");
            }
            state.migrationVersion = 1;
          }

          // Migration v2: Add fullAthanPlayback for existing users
          if (state.migrationVersion < 2) {
            if (state.fullAthanPlayback === undefined) {
              state.fullAthanPlayback = false;
              log.i("Store", "migration v2: added fullAthanPlayback default");
            }
            state.migrationVersion = 2;
          }

          // Migration v3: Add athanAudioStream for existing users
          if (state.migrationVersion < 3) {
            if (state.athanAudioStream === undefined) {
              state.athanAudioStream = "media";
              log.i("Store", "migration v3: added athanAudioStream default");
            }
            state.migrationVersion = 3;
          }

          // Migration v4: Add fullIqamaPlayback and iqamaAudioStream for existing users
          if (state.migrationVersion < 4) {
            if (state.fullIqamaPlayback === undefined) {
              state.fullIqamaPlayback = false;
              log.i("Store", "migration v4: added fullIqamaPlayback default");
            }
            if (state.iqamaAudioStream === undefined) {
              state.iqamaAudioStream = "media";
              log.i("Store", "migration v4: added iqamaAudioStream default");
            }
            state.migrationVersion = 4;
          }

          if (state.migrationVersion < 5) {
            if (!state.otherTimingNotifications) {
              state.otherTimingNotifications = defaultOtherTimingNotifications;
              log.i("Store", "migration v5: added otherTimingNotifications defaults");
            }
            state.migrationVersion = 5;
          }

          if (state.migrationVersion < 6) {
            if (!state.duhaTime) {
              state.duhaTime = defaultDuhaTime;
              log.i("Store", "migration v6: added duhaTime defaults");
            }
            state.migrationVersion = 6;
          }

          // Sync native preferences on rehydration
          if (Platform.OS === "android") {
            import("expo-alarm")
              .then(({ setAthanAudioStream, setIqamaAudioStream }) => {
                setAthanAudioStream(state.athanAudioStream ?? "media");
                setIqamaAudioStream(state.iqamaAudioStream ?? "media");
              })
              .catch((e) => {
                log.w("Store", `native audio-stream pref sync failed: ${e?.message ?? e}`);
              });
          }
        },
      }
    ),
    { name: "NotificationStore" }
  )
);

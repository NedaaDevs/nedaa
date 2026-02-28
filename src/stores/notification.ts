import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { openSettings } from "expo-linking";

// Utils
import { cancelAllScheduledNotifications } from "@/utils/notifications";
import { scheduleAllNotifications, shouldReschedule } from "@/utils/notificationScheduler";
import { buildUsedSoundsSet } from "@/utils/customSoundManager";

// Stores
import locationStore from "@/stores/location";
import prayerTimesStore from "@/stores/prayerTimes";

// Services
import { QadaDB } from "@/services/qada-db";

// Types
import {
  AthkarNotificationSettings,
  ConfigForType,
  getEffectiveConfig,
  NotificationType,
  type NotificationAction,
  type NotificationSettings,
  type NotificationState,
} from "@/types/notification";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

export type NotificationStore = NotificationState & NotificationAction;

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

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set, get) => ({
        settings: defaultSettings,
        isScheduling: false,
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

        updateFullAthanPlayback: async (enabled) => {
          set({ fullAthanPlayback: enabled });
          await get().scheduleAllNotifications();
        },

        updateAllNotificationToggle: async (enabled) => {
          set((state) => ({
            settings: { ...state.settings, enabled },
          }));

          // If disabling, cancel all notifications
          if (!enabled) {
            await cancelAllScheduledNotifications();
          } else {
            await get().scheduleAllNotifications();
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

          await get().scheduleAllNotifications();
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

          await get().scheduleAllNotifications();
        },

        updateOverride: async <T extends NotificationType>(
          prayerId: string,
          type: T,
          config: Partial<ConfigForType<T>>
        ) => {
          set((state) => {
            const newOverrides = { ...state.settings.overrides };

            if (!newOverrides[prayerId]) {
              newOverrides[prayerId] = {};
            }

            // If config is empty, remove the override
            if (Object.keys(config).length === 0) {
              delete newOverrides[prayerId][type];
              if (Object.keys(newOverrides[prayerId]).length === 0) {
                delete newOverrides[prayerId];
              }
            } else {
              newOverrides[prayerId] = {
                ...newOverrides[prayerId],
                [type]: config,
              };
            }

            return {
              settings: { ...state.settings, overrides: newOverrides },
            };
          });

          await get().scheduleAllNotifications();
        },

        resetOverride: async (prayerId, type) => {
          await get().updateOverride(prayerId, type, {});
        },

        resetAllOverrides: async () => {
          set((state) => ({
            settings: { ...state.settings, overrides: {} },
          }));
          await get().scheduleAllNotifications();
        },

        scheduleAllNotifications: async () => {
          const { settings, morningNotification, eveningNotification, fullAthanPlayback } = get();
          if (!settings.enabled) return;

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
              { fullAthanPlayback }
            );

            if (result.success) {
              set({ lastScheduledDate: new Date().toISOString() });
              console.log(`Scheduled ${result.scheduledCount} notifications`);
            } else {
              console.error("Failed to schedule notifications:", result.error);
            }
          } finally {
            set({ isScheduling: false });
          }
        },

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

          await get().scheduleAllNotifications();
        },

        getEffectiveConfigForPrayer: <T extends Exclude<NotificationType, "athkar">>(
          prayerId: string,
          type: T
        ): ConfigForType<T> => {
          const { settings } = get();
          return getEffectiveConfig(prayerId, type, settings.defaults, settings.overrides);
        },
        updateSettings: async (newSettings: NotificationSettings) => {
          set({ settings: newSettings });
          await get().scheduleAllNotifications();
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
              console.log("[Notification Store] Migration v1: Added qada defaults");
            }
            state.migrationVersion = 1;
          }

          // Migration v2: Add fullAthanPlayback for existing users
          if (state.migrationVersion < 2) {
            if (state.fullAthanPlayback === undefined) {
              state.fullAthanPlayback = false;
              console.log("[Notification Store] Migration v2: Added fullAthanPlayback default");
            }
            state.migrationVersion = 2;
          }
        },
      }
    ),
    { name: "NotificationStore" }
  )
);

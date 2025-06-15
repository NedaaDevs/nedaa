import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { openSettings } from "expo-linking";

// Utils
import { cancelAllScheduledNotifications } from "@/utils/notifications";
import { scheduleAllNotifications, shouldReschedule } from "@/utils/notificationScheduler";

// Stores
import locationStore from "@/stores/location";
import prayerTimesStore from "@/stores/prayerTimes";

// Types
import {
  ConfigForType,
  getEffectiveConfig,
  NotificationType,
  type NotificationAction,
  type NotificationSettings,
  type NotificationState,
} from "@/types/notification";

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
      sound: "silent",
      vibration: true,
      timing: 10,
    },
    preAthan: {
      enabled: false,
      sound: "silent",
      vibration: false,
      timing: 15,
    },
  },
  overrides: {},
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set, get) => ({
        settings: defaultSettings,
        isScheduling: false,
        lastScheduledDate: null,

        updateAllNotificationToggle: (enabled) => {
          set((state) => ({
            settings: { ...state.settings, enabled },
          }));

          // If disabling, cancel all notifications
          if (!enabled) {
            cancelAllScheduledNotifications();
          }
        },

        updateQuickSetup: (sound, vibration) => {
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

          // Reschedule notifications to update channels with new sound
          setTimeout(() => {
            get().scheduleAllNotifications();
          }, 100);
        },

        updateDefault: (type, field, value) => {
          set((state) => ({
            settings: {
              ...state.settings,
              defaults: {
                ...state.settings.defaults,
                [type]: { ...state.settings.defaults[type], [field]: value },
              },
            },
          }));

          // If sound changed, reschedule to update channels
          if (field === "sound") {
            setTimeout(() => {
              get().scheduleAllNotifications();
            }, 100);
          }
        },

        updateOverride: <T extends NotificationType>(
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

          // If sound changed in config, reschedule to update channels
          if (config.sound !== undefined) {
            setTimeout(() => {
              get().scheduleAllNotifications();
            }, 100);
          }
        },

        resetOverride: (prayerId, type) => {
          get().updateOverride(prayerId, type, {});
        },

        resetAllOverrides: () => {
          set((state) => ({
            settings: { ...state.settings, overrides: {} },
          }));
        },

        scheduleAllNotifications: async () => {
          const { settings } = get();
          if (!settings.enabled) return;

          set({ isScheduling: true });

          try {
            const timezone = locationStore.getState().locationDetails.timezone;

            // Get two weeks worth of prayer data
            const prayersData = prayerTimesStore.getState().twoWeeksTimings;

            const result = await scheduleAllNotifications(settings, prayersData, timezone);

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
        getEffectiveConfigForPrayer: <T extends NotificationType>(
          prayerId: string,
          type: T
        ): ConfigForType<T> => {
          const { settings } = get();
          return getEffectiveConfig(prayerId, type, settings.defaults, settings.overrides);
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
      }
    ),
    { name: "NotificationStore" }
  )
);

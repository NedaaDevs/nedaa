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

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage } from "zustand/middleware";
import { openSettings } from "expo-linking";
import { addMinutes, addSeconds } from "date-fns";

// Utils
import {
  scheduleNotification,
  listScheduledNotifications,
  cancelAllScheduledNotifications,
} from "@/utils/notifications";
import { timeZonedNow } from "@/utils/date";

// Stores
import locationStore from "@/stores/location";

// Types
import {
  getEffectiveConfig,
  type NotificationAction,
  type NotificationSettings,
  type NotificationState,
} from "@/types/notification";

type NotificationStore = NotificationState & NotificationAction;

const defaultSettings: NotificationSettings = {
  enabled: true,
  defaults: {
    prayer: {
      enabled: true,
      sound: "makkah",
      vibration: true,
    },
    iqama: {
      enabled: false,
      sound: "gentle",
      vibration: true,
      timing: 10,
    },
    preAthan: {
      enabled: false,
      sound: "bell",
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
            get().clearAllNotifications();
          }
        },

        updateQuickSetup: (sound, vibration) => {
          set((state) => ({
            settings: {
              ...state.settings,
              defaults: {
                prayer: { ...state.settings.defaults.prayer, sound, vibration },
                iqama: { ...state.settings.defaults.iqama, sound, vibration },
                preAthan: { ...state.settings.defaults.preAthan, sound, vibration },
              },
            },
          }));
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
        },

        updateOverride: (prayerId, type, config) => {
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
              newOverrides[prayerId][type] = config;
            }

            return {
              settings: { ...state.settings, overrides: newOverrides },
            };
          });
        },

        resetOverride: (prayerId, type) => {
          get().updateOverride(prayerId, type, {});
        },

        resetAllOverrides: () => {
          set((state) => ({
            settings: { ...state.settings, overrides: {} },
          }));
        },
        scheduleTestNotification: async () => {
          const now = timeZonedNow(locationStore.getState().locationDetails.timezone);
          await scheduleNotification(
            addSeconds(now, 10),
            "Test Notification",
            `This is a test notification with 10 seconds`
          );

          await scheduleNotification(
            addMinutes(now, 10),
            "Test Notification",
            `This is a test notification with 10m`
          );

          console.log(await get().getScheduledNotifications());
        },

        getEffectiveConfigForPrayer: (prayerId, type) => {
          const { settings } = get();
          return getEffectiveConfig(prayerId, type, settings.defaults, settings.overrides);
        },

        getScheduledNotifications: async () => await listScheduledNotifications(),
        clearNotifications: async () => {
          await cancelAllScheduledNotifications();
        },

        clearAllNotifications: async () => {
          await cancelAllScheduledNotifications();
          set({ lastScheduledDate: null });
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

import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { openSettings } from "expo-linking";
import { addMinutes, addSeconds, subMinutes } from "date-fns";
import { Platform } from "react-native";
import { cancelScheduledNotificationAsync } from "expo-notifications";

// Utils
import {
  scheduleNotification,
  listScheduledNotifications,
  cancelAllScheduledNotifications,
} from "@/utils/notifications";
import { timeZonedNow } from "@/utils/date";

// Stores
import locationStore from "@/stores/location";
import prayerTimesStore from "@/stores/prayerTimes";

// Types
import {
  getEffectiveConfig,
  NotificationConfig,
  NotificationWithTiming,
  type NotificationAction,
  type NotificationSettings,
  type NotificationState,
} from "@/types/notification";
import { PrayerName } from "@/types/prayerTimes";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Enums
import { PlatformType } from "@/enums/app";

type NotificationStore = NotificationState & NotificationAction;

const PRAYER_IDS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

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

        scheduleAllNotifications: async () => {
          const { settings } = get();

          if (!settings.enabled) return;

          set({ isScheduling: true });

          try {
            // Cancel all existing notifications
            await cancelAllScheduledNotifications();

            // Get today's prayer times from prayer store
            const prayerTimes = prayerTimesStore.getState().todayTimings?.timings;
            if (!prayerTimes) return;

            // Schedule notifications for each prayer
            for (const prayerId of PRAYER_IDS) {
              const prayerTime = prayerTimes[prayerId];
              if (prayerTime) {
                await get().schedulePrayerNotifications(prayerId, new Date(prayerTime));
              }
            }

            set({ lastScheduledDate: new Date().toISOString() });
          } catch (error) {
            console.error("Failed to schedule notifications:", error);
          } finally {
            set({ isScheduling: false });
          }
        },

        schedulePrayerNotifications: async (prayerId, prayerTime) => {
          const { settings } = get();
          if (!settings.enabled) return;

          const timezone = locationStore.getState().locationDetails.timezone;
          const now = timeZonedNow(timezone);

          // Get effective configs for all notification types
          const prayerConfig = get().getEffectiveConfigForPrayer<NotificationConfig>(
            prayerId,
            NOTIFICATION_TYPE.PRAYER
          );
          const iqamaConfig = get().getEffectiveConfigForPrayer<NotificationWithTiming>(
            prayerId,
            NOTIFICATION_TYPE.IQAMA
          );
          const preAthanConfig = get().getEffectiveConfigForPrayer<NotificationWithTiming>(
            prayerId,
            NOTIFICATION_TYPE.PRE_ATHAN
          );

          // Schedule Prayer notification
          if (prayerConfig.enabled && prayerTime > now) {
            const title = `Prayer Time - ${prayerId.charAt(0).toUpperCase() + prayerId.slice(1)}`;
            const body = `It's time for ${prayerId} prayer`;

            await scheduleNotification(prayerTime, title, body, {
              sound: prayerConfig.sound,
              vibrate: Platform.OS === PlatformType.ANDROID ? prayerConfig.vibration : false,
              categoryId: `prayer_${prayerId}`,
            });
          }

          // Schedule Iqama reminder
          if (iqamaConfig.enabled && prayerTime > now) {
            const iqamaTime = addMinutes(prayerTime, iqamaConfig.timing);
            if (iqamaTime > now) {
              const title = `Iqama Reminder - ${prayerId.charAt(0).toUpperCase() + prayerId.slice(1)}`;
              const body = `Iqama for ${prayerId} is starting soon`;

              await scheduleNotification(iqamaTime, title, body, {
                sound: iqamaConfig.sound,
                vibrate: Platform.OS === "android" ? iqamaConfig.vibration : false,
                categoryId: `iqama_${prayerId}`,
              });
            }
          }

          // Schedule Pre-Athan alert
          if (preAthanConfig.enabled) {
            const preAthanTime = subMinutes(prayerTime, preAthanConfig.timing);
            if (preAthanTime > now) {
              const title = `Prayer Alert - ${prayerId.charAt(0).toUpperCase() + prayerId.slice(1)}`;
              const body = `${prayerId} prayer will be in ${preAthanConfig.timing} minutes`;

              await scheduleNotification(preAthanTime, title, body, {
                sound: preAthanConfig.sound,
                vibrate: Platform.OS === "android" ? preAthanConfig.vibration : false,
                categoryId: `preathan_${prayerId}`,
              });
            }
          }
        },

        cancelPrayerNotifications: async (prayerId) => {
          const scheduled = await listScheduledNotifications();
          const prayerNotifications = scheduled.filter((notif) =>
            notif.content.data?.categoryId?.includes(prayerId)
          );

          for (const notif of prayerNotifications) {
            await cancelScheduledNotificationAsync(notif.identifier);
          }
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

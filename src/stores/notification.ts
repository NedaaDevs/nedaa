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
import type { NotificationAction, NotificationState } from "@/types/notification";

type NotificationStore = NotificationState & NotificationAction;

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (_, get) => ({
        isScheduling: false,
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

        getScheduledNotifications: async () => await listScheduledNotifications(),
        clearNotifications: async () => {
          await cancelAllScheduledNotifications();
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

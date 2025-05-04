import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage } from "zustand/middleware";
import { openSettings } from "expo-linking";
import { NotificationRequest } from "expo-notifications";
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

export type NotificationState = {
  scheduleTestNotification: () => Promise<void>;
  getScheduledNotifications: () => Promise<NotificationRequest[]>;
  clearNotifications: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
};

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (_, get) => ({
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

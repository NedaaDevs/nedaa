import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage } from "zustand/middleware";
import { openSettings } from "expo-linking";

// Utils
import {
  checkPermissions,
  requestPermissions,
  scheduleNotification,
  listScheduledNotifications,
  mapToLocalStatus,
  cancelAllScheduledNotifications,
} from "@/utils/notifications";

// Types and enums
import { NotificationState } from "@/types/notifications";
import { LocalPermissionStatus } from "@/enums/notifications";

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        permissions: {
          status: LocalPermissionStatus.UNDETERMINED,
          canRequestAgain: true,
        },
        scheduledNotifications: [],

        refreshPermissions: async () => {
          const result = await checkPermissions();
          set({
            permissions: {
              status: mapToLocalStatus(result.status),
              canRequestAgain: result.canAskAgain,
            },
          });
        },

        requestNotificationPermission: async () => {
          const result = await requestPermissions();
          const status = mapToLocalStatus(result.status);
          set({
            permissions: {
              status,
              canRequestAgain: result.canAskAgain,
            },
          });
          return status === LocalPermissionStatus.GRANTED;
        },

        scheduleTestNotification: async () => {
          const result = await scheduleNotification(
            10,
            "Test Notification",
            "This is a test notification",
          );

          if (result.success) {
            await get().refreshScheduledNotifications();
          }
        },

        refreshScheduledNotifications: async () => {
          const notifications = await listScheduledNotifications();
          set({ scheduledNotifications: notifications });
        },

        clearNotifications: async () => {
          await cancelAllScheduledNotifications();
          set({
            scheduledNotifications: [],
          });
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
        partialize: (state) => ({
          permissions: state.permissions,
        }),
      },
    ),
    { name: "NotificationStore" },
  ),
);

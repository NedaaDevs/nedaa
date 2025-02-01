import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage } from "zustand/middleware";
import { openSettings } from "expo-linking";
import { Platform } from "react-native";
import { IosAuthorizationStatus } from "expo-notifications";

// Utils
import {
  checkPermissions,
  requestPermissions,
  scheduleNotification,
  listScheduledNotifications,
  mapToLocalStatus,
  cancelAllScheduledNotifications,
  configureNotifications,
} from "@/utils/notifications";

// Types and enums
import { NotificationState } from "@/types/notifications";
import { LocalPermissionStatus } from "@/enums/notifications";
import { PlatformType } from "@/enums/app";

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        permissions: {
          status: LocalPermissionStatus.UNDETERMINED,
          canRequestAgain: true,
        },

        refreshPermissions: async () => {
          const result = await checkPermissions();

          if (Platform.OS === PlatformType.IOS) {
            const status =
              result.status || result.ios?.status === IosAuthorizationStatus.PROVISIONAL;

            set({
              permissions: {
                status: mapToLocalStatus(status),
                canRequestAgain: result.canAskAgain,
              },
            });
          }

          set({
            permissions: {
              status: mapToLocalStatus(result.status),
              canRequestAgain: result.canAskAgain,
            },
          });
        },

        requestNotificationPermission: async () => {
          configureNotifications();
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
          await get().clearNotifications();
          await scheduleNotification(
            1 * 10,
            "Test Notification",
            `This is a test notification with 10 seconds`
          );

          await scheduleNotification(
            60 * 1 * 10,
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
        partialize: (state) => ({
          permissions: state.permissions,
        }),
      }
    ),
    { name: "NotificationStore" }
  )
);

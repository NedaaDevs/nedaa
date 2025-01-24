import { create } from "zustand";
import { openSettings } from "expo-linking";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// Utils
import { mapToLocalStatus } from "@/utils/notifications";

// Types
import {
  LocalPermissionStatus,
  NotificationPermissionsState,
} from "@/types/notifications";

export type NotificationStore = {
  permissions: NotificationPermissionsState;
  checkPermissions: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  openSystemSettings: () => Promise<void>;
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set) => ({
        permissions: {
          status: LocalPermissionStatus.UNDETERMINED,
          canRequestAgain: true,
        },

        checkPermissions: async () => {
          try {
            const result = await Notifications.getPermissionsAsync();

            set({
              permissions: {
                status: mapToLocalStatus(result.status),
                canRequestAgain: result.canAskAgain,
              },
            });
          } catch (error) {
            console.error("Permission check failed:", error);
            set({
              permissions: {
                status: LocalPermissionStatus.UNDETERMINED,
                canRequestAgain: true,
              },
            });
          }
        },

        requestPermissions: async () => {
          try {
            const result = await Notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });

            const newState = {
              status: mapToLocalStatus(result.status),
              canRequestAgain: result.canAskAgain,
            };

            set({ permissions: newState });
            return newState.status === LocalPermissionStatus.GRANTED;
          } catch (error) {
            console.error("Permission request failed:", error);
            return false;
          }
        },

        openSystemSettings: async () => {
          try {
            await openSettings();
          } catch (error) {
            console.error("Failed to open settings:", error);
          }
        },
      }),
      {
        name: "notification-storage",
        storage: createJSONStorage(() => AsyncStorage),
        // Selective Persistence: permissions only
        partialize: (state) => ({
          permissions: {
            ...state.permissions,
          },
        }),
      },
    ),
    { name: "NotificationStore" },
  ),
);

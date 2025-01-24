import { useEffect } from "react";

// Stores
import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";
import { useLocationStore } from "@/stores/location";

// Services
import { performFirstRunSetup } from "@/services/setup";

export const useInitialSetup = () => {
  const appStore = useAppStore();
  const notificationStore = useNotificationStore();
  const locationStore = useLocationStore();
  useEffect(() => {
    const initializeApp = async () => {
      await performFirstRunSetup(appStore, notificationStore, locationStore);
    };

    initializeApp();
  }, []);
};

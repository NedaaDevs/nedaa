import { useEffect } from "react";

// Stores
import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";

// Services
import { performFirstRunSetup } from "@/services/setup";

export const useInitialSetup = () => {
  const appStore = useAppStore();
  const notificationStore = useNotificationStore();
  useEffect(() => {
    const initializeApp = async () => {
      await performFirstRunSetup(appStore, notificationStore);
    };

    initializeApp();
  }, []);
};

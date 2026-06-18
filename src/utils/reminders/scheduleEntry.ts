import { useNotificationStore } from "@/stores/notification";

// Re-runs the full notification schedule so reminder changes take effect, reusing
// the notification store's scheduling action (which cancels and reschedules all
// notifications, including Quran reminders).
export const scheduleFromCurrentState = async (): Promise<void> => {
  await useNotificationStore.getState().scheduleAllNotifications();
};

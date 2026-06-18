import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";

export type ReminderPermissionOutcome = "granted" | "denied";

// Grants immediately if already granted, otherwise prompts the OS once and maps
// the result. The in-context priming UI lives in the reminder row; this owns the
// system request and its outcome.
export const ensureReminderPermission = async (): Promise<ReminderPermissionOutcome> => {
  const current = await checkPermissions();
  if (current.status === "granted") return "granted";
  const requested = await requestNotificationPermission();
  return requested.status === "granted" ? "granted" : "denied";
};

export const useReminderPermission = () => ({ ensureReminderPermission });

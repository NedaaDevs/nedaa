// Re-arms scheduled notifications so reminder changes take effect. Delegates to
// the schedule entry seam, which the notification-scheduler task wires to the
// full scheduler.
export const rearmReminders = async (): Promise<void> => {
  const mod = await import("@/utils/reminders/scheduleEntry");
  await mod.scheduleFromCurrentState();
};

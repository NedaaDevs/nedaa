// A reschedule should be forced only when notification permission has just
// transitioned to granted (e.g. the user enabled it in system settings and came
// back). When permission was already granted, the guarded reschedule path skips
// work that's already done for the day, so no force is needed.
export const shouldForceReschedule = (previouslyGranted: boolean, nowGranted: boolean): boolean =>
  nowGranted && !previouslyGranted;

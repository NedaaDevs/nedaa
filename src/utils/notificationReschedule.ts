import { TASK_RESULT, type TaskResult } from "@/constants/BackgroundTask";
import type { SchedulingResult } from "@/types/notification";

// A reschedule should be forced only when notification permission has just
// transitioned to granted (e.g. the user enabled it in system settings and came
// back). When permission was already granted, the guarded reschedule path skips
// work that's already done for the day, so no force is needed.
export const shouldForceReschedule = (previouslyGranted: boolean, nowGranted: boolean): boolean =>
  nowGranted && !previouslyGranted;

export type SchedulingLogSummary = {
  result: TaskResult;
  details: string;
};

// Maps a scheduling run onto a task-log entry. A skip (permission revoked,
// notifications off, no data) is visible but distinct from a genuine failure,
// so "notifications stopped" reports show which of the two happened.
export const summarizeSchedulingResult = (result: SchedulingResult): SchedulingLogSummary => {
  if (result.skipReason) {
    return { result: TASK_RESULT.SKIPPED, details: `nothing scheduled: ${result.skipReason}` };
  }
  if (!result.success) {
    return {
      result: TASK_RESULT.FAILED,
      details: result.error?.message ?? "unknown scheduling error",
    };
  }
  return {
    result: TASK_RESULT.SUCCESS,
    details:
      `scheduled ${result.scheduledCount}` +
      (result.lastScheduledAt ? ` through ${result.lastScheduledAt}` : "") +
      (result.failedCount ? `, ${result.failedCount} failed` : ""),
  };
};

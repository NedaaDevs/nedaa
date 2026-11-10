/** Test ids of the feedback screen's spoken statuses. */
export const FEEDBACK_STATUS_ID = {
  SENT: "feedback-status-sent",
  FAILED: "feedback-status-failed",
  OFFLINE: "feedback-status-offline",
  IMAGE: "feedback-status-image",
} as const;

/** Test ids of the crash prompt's spoken statuses. */
export const CRASH_REPORT_STATUS_ID = {
  SENT: "crash-report-status-sent",
  FAILED: "crash-report-status-failed",
  OFFLINE: "crash-report-status-offline",
} as const;

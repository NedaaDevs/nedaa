/** Test id of the report sheet's spoken status. */
export const REPORT_PROBLEM_STATUS_ID = "report-problem-status";

/** Where a report sent from the sheet stands; a sent one closes the sheet. */
export const REPORT_SUBMIT_STATUS = {
  IDLE: "idle",
  SUBMITTING: "submitting",
  ERROR: "error",
} as const;
export type ReportSubmitStatus = (typeof REPORT_SUBMIT_STATUS)[keyof typeof REPORT_SUBMIT_STATUS];

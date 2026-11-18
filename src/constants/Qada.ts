/** What a `qada_history` row records: a batch the person added, or days made up. */
export const QADA_ENTRY_TYPE = {
  ADDED: "added",
  COMPLETED: "completed",
  REMOVED: "removed",
} as const;
export type QadaEntryType = (typeof QADA_ENTRY_TYPE)[keyof typeof QADA_ENTRY_TYPE];

/** A batch with days left is pending. */
export const QADA_ENTRY_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  DELETED: "deleted",
} as const;
export type QadaEntryStatus = (typeof QADA_ENTRY_STATUS)[keyof typeof QADA_ENTRY_STATUS];

/** Days a new batch can hold. */
export const QADA_BATCH_DAYS = { MIN: 1, MAX: 999 } as const;

/** One-tap sizes in the add sheet. */
export const QADA_QUICK_DAYS = [1, 3, 7] as const;

/** Recorded days the history lists. */
export const QADA_HISTORY_LIMIT = 60;

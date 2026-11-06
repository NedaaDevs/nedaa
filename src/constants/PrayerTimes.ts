/** How one fetch of a year's prayer times ended. */
export const TIMES_FETCH = {
  STORED: "stored",
  FAILED: "failed",
  /** The place moved while the fetch was out, so it wrote nothing. */
  SUPERSEDED: "superseded",
} as const;
export type TimesFetch = (typeof TIMES_FETCH)[keyof typeof TIMES_FETCH];

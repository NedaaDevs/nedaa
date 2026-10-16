/** What the prayer-detail sheet shows: its settings, or a state instead. */
export const PRAYER_DETAIL_STATE = {
  READY: "ready",
  LOADING: "loading",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
} as const;

export type PrayerDetailState = (typeof PRAYER_DETAIL_STATE)[keyof typeof PRAYER_DETAIL_STATE];

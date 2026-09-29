/** Why a state panel stands in for content: a wait, a gap, or a failure. */
export const STATE_PANEL_KIND = {
  LOADING: "loading",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
} as const;

export type StatePanelKind = (typeof STATE_PANEL_KIND)[keyof typeof STATE_PANEL_KIND];

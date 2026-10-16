/** Why a state panel stands in for content: a wait, a gap, or a failure. */
export const STATE_PANEL_KIND = {
  LOADING: "loading",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
} as const;

export type StatePanelKind = (typeof STATE_PANEL_KIND)[keyof typeof STATE_PANEL_KIND];

/** How a state panel sits: framed on a screen, or flat on a sheet's surface. */
export const STATE_PANEL_VARIANT = {
  CARD: "card",
  FLAT: "flat",
} as const;

export type StatePanelVariant = (typeof STATE_PANEL_VARIANT)[keyof typeof STATE_PANEL_VARIANT];

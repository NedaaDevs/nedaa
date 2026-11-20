/** Where the look chooser opens from. */
export const CHOOSER_MODE = {
  /** A first visit to Athkar: the chooser stands in for the tab bar. */
  FIRST: "first",
  /** Athkar settings: a screen of its own, with a way back. */
  SETTINGS: "settings",
} as const;

export type ChooserMode = (typeof CHOOSER_MODE)[keyof typeof CHOOSER_MODE];

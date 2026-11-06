/** Whether the bottom action bar shows, and whether its action can run. */
export const STICKY_ACTION_STATE = {
  HIDDEN: "hidden",
  READY: "ready",
  BUSY: "busy",
} as const;

export type StickyActionState = (typeof STICKY_ACTION_STATE)[keyof typeof STICKY_ACTION_STATE];

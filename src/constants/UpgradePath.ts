/** Where a 2.x user stands on the walk through the V3 choices. */
export const UPGRADE_PATH_STATE = {
  PENDING: "pending",
  LATER: "later",
  RESUMED: "resumed",
  DONE: "done",
} as const;

export type UpgradePathState = (typeof UPGRADE_PATH_STATE)[keyof typeof UPGRADE_PATH_STATE];

export const UPGRADE_PATH_STATES: readonly UpgradePathState[] = Object.values(UPGRADE_PATH_STATE);

/** Whether a saved value names a state this build knows. */
export const isUpgradePathState = (value: unknown): value is UpgradePathState =>
  UPGRADE_PATH_STATES.some((state) => state === value);

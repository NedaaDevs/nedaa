import { WhatsNewId } from "@/constants/WhatsNew";

/** Where a 2.x user stands on the walk through the V3 choices. */
export const UPGRADE_PATH_STATE = {
  PENDING: "pending",
  LATER: "later",
  RESUMED: "resumed",
  DONE: "done",
} as const;

export type UpgradePathState = (typeof UPGRADE_PATH_STATE)[keyof typeof UPGRADE_PATH_STATE];

const UPGRADE_PATH_STATES: readonly UpgradePathState[] = Object.values(UPGRADE_PATH_STATE);

/** Whether a saved value names a state this build knows. */
export const isUpgradePathState = (value: unknown): value is UpgradePathState =>
  UPGRADE_PATH_STATES.some((state) => state === value);

/** What's New entries the path covers; showing the path marks them seen. */
export const UPGRADE_PATH_WHATS_NEW_IDS: readonly WhatsNewId[] = [WhatsNewId.TEXT_SIZE];

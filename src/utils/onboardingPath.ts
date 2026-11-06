import { ONBOARDING_PATH, type OnboardingPath } from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE, type UpgradePathState } from "@/constants/UpgradePath";

type PathInput = {
  isFirstRun: boolean;
  upgradePath: UpgradePathState;
  /** The launch came from a tapped notification or an alarm link. */
  launchedByAlert: boolean;
  /** An alarm screen showed at some point in this launch. */
  alarmScreenSeen: boolean;
};

/** The walk the gate opens on this launch, or null for the app itself. */
export const onboardingPathFor = ({
  isFirstRun,
  upgradePath,
  launchedByAlert,
  alarmScreenSeen,
}: PathInput): OnboardingPath | null => {
  if (isFirstRun) return ONBOARDING_PATH.FIRST_RUN;
  // An alarm or an athan never lands on the path; the next launch opens it.
  if (launchedByAlert || alarmScreenSeen) return null;
  const open =
    upgradePath === UPGRADE_PATH_STATE.PENDING || upgradePath === UPGRADE_PATH_STATE.RESUMED;
  return open ? ONBOARDING_PATH.UPGRADE : null;
};

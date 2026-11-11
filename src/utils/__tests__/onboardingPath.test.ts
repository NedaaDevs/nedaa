import { ONBOARDING_PATH, type OnboardingPath } from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE, type UpgradePathState } from "@/constants/UpgradePath";
import { onboardingPathFor } from "@/utils/onboardingPath";

type Row = {
  name: string;
  isFirstRun: boolean;
  upgradePath: UpgradePathState;
  launchedByAlert: boolean;
  alarmScreenSeen: boolean;
  expected: OnboardingPath | null;
};

const NORMAL = { isFirstRun: false, launchedByAlert: false, alarmScreenSeen: false };

const ROWS: Row[] = [
  {
    name: "a first run walks the whole flow",
    ...NORMAL,
    isFirstRun: true,
    upgradePath: UPGRADE_PATH_STATE.PENDING,
    expected: ONBOARDING_PATH.FIRST_RUN,
  },
  {
    name: "a first run stays a first run after an alert launch",
    isFirstRun: true,
    upgradePath: UPGRADE_PATH_STATE.PENDING,
    launchedByAlert: true,
    alarmScreenSeen: true,
    expected: ONBOARDING_PATH.FIRST_RUN,
  },
  {
    name: "a pending upgrader meets the path",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.PENDING,
    expected: ONBOARDING_PATH.UPGRADE,
  },
  {
    name: "a resumed upgrader meets the path",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.RESUMED,
    expected: ONBOARDING_PATH.UPGRADE,
  },
  {
    name: "Later keeps the path closed",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.LATER,
    expected: null,
  },
  {
    name: "a finished path stays closed",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.DONE,
    expected: null,
  },
  {
    name: "an alert launch holds the path back",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.PENDING,
    launchedByAlert: true,
    expected: null,
  },
  {
    name: "the alarm screen holds the path back",
    ...NORMAL,
    upgradePath: UPGRADE_PATH_STATE.RESUMED,
    alarmScreenSeen: true,
    expected: null,
  },
];

describe("onboardingPathFor", () => {
  it.each(ROWS)("$name", ({ expected, name: _name, ...input }) => {
    expect(onboardingPathFor(input)).toBe(expected);
  });
});

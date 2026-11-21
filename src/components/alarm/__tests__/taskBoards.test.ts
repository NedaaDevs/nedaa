import DhikrBoard from "@/components/alarm/challenges/DhikrBoard";
import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import { taskBoards } from "@/components/alarm/challenges/taskBoards";
import { WAKE_TASK_ID, WAKE_TASK_IDS } from "@/constants/WakeTask";
import {
  DHIKR_REVIEWED_ABOUT_KEY,
  WAKE_TASK_ABOUT_KEY,
  WAKE_TASK_NAME_KEY,
} from "@/constants/WakeTaskShell";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const REVIEWED = [true, false] as const;

describe("taskBoards", () => {
  it("runs the typed dhikr board and its description while the list is unreviewed", () => {
    const dhikr = taskBoards(false)[WAKE_TASK_ID.DHIKR];

    expect(dhikr.Component).toBe(DhikrChallenge);
    expect(dhikr.aboutKey).toBe(WAKE_TASK_ABOUT_KEY[WAKE_TASK_ID.DHIKR]);
  });

  it("runs the word board and its description once the list is reviewed", () => {
    const dhikr = taskBoards(true)[WAKE_TASK_ID.DHIKR];

    expect(dhikr.Component).toBe(DhikrBoard);
    expect(dhikr.aboutKey).toBe(DHIKR_REVIEWED_ABOUT_KEY);
  });

  it.each(REVIEWED)("names the dhikr task alike either way (reviewed: %s)", (reviewed) => {
    expect(taskBoards(reviewed)[WAKE_TASK_ID.DHIKR].titleKey).toBe(
      WAKE_TASK_NAME_KEY[WAKE_TASK_ID.DHIKR]
    );
  });

  it("changes no other task's board", () => {
    WAKE_TASK_IDS.filter((id) => id !== WAKE_TASK_ID.DHIKR).forEach((id) => {
      const [reviewed, unreviewed] = REVIEWED.map((flag) => taskBoards(flag)[id]);
      expect(reviewed.Component).toBe(unreviewed.Component);
      expect(reviewed.titleKey).toBe(unreviewed.titleKey);
      expect(reviewed.aboutKey).toBe(WAKE_TASK_ABOUT_KEY[id]);
      expect(unreviewed.aboutKey).toBe(WAKE_TASK_ABOUT_KEY[id]);
    });
  });
});

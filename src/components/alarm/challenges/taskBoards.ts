import type { FC } from "react";

import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import MathBoard from "@/components/alarm/challenges/MathBoard";
import PatternBoard from "@/components/alarm/challenges/PatternBoard";
import PrayersBoard from "@/components/alarm/challenges/PrayersBoard";
import TapBoard from "@/components/alarm/challenges/TapBoard";
import { WAKE_TASK_ID, type WakeTaskId } from "@/constants/WakeTask";
import { WAKE_TASK_NAME_KEY } from "@/constants/WakeTaskShell";
import type { ChallengeDifficulty } from "@/types/alarm";

/** What the shell gives every board. */
export type BoardProps = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
  /** The shell's opening line, given to a board that says it. */
  opening?: string | null;
};

export type Board = {
  Component: FC<BoardProps>;
  titleKey: string;
  /** Takes reader focus as it opens, so it says the shell's opening line. */
  saysOpening?: boolean;
};

/** The board each task runs; a task with no entry fails the build. */
export const TASK_BOARDS = {
  [WAKE_TASK_ID.MATH]: { Component: MathBoard, titleKey: "alarm.task.title.math" },
  [WAKE_TASK_ID.DHIKR]: { Component: DhikrChallenge, titleKey: WAKE_TASK_NAME_KEY.dhikr },
  [WAKE_TASK_ID.TAP]: { Component: TapBoard, titleKey: WAKE_TASK_NAME_KEY.tap },
  [WAKE_TASK_ID.PATTERN]: {
    Component: PatternBoard,
    titleKey: WAKE_TASK_NAME_KEY.pattern,
    saysOpening: true,
  },
  [WAKE_TASK_ID.PRAYERS]: { Component: PrayersBoard, titleKey: WAKE_TASK_NAME_KEY.prayers },
} as const satisfies Record<WakeTaskId, Board>;

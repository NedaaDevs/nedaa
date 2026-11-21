import type { FC } from "react";

import DhikrBoard from "@/components/alarm/challenges/DhikrBoard";
import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import MathBoard from "@/components/alarm/challenges/MathBoard";
import PatternBoard from "@/components/alarm/challenges/PatternBoard";
import PrayersBoard from "@/components/alarm/challenges/PrayersBoard";
import TapBoard from "@/components/alarm/challenges/TapBoard";
import { DHIKR_TASK_REVIEWED } from "@/constants/DhikrTask";
import { WAKE_TASK_ID, type WakeTaskId } from "@/constants/WakeTask";
import {
  DHIKR_REVIEWED_ABOUT_KEY,
  WAKE_TASK_ABOUT_KEY,
  WAKE_TASK_NAME_KEY,
} from "@/constants/WakeTaskShell";
import type { ChallengeDifficulty } from "@/types/alarm";

/** What the shell gives every board. */
export type BoardProps = {
  difficulty: ChallengeDifficulty;
  onComplete: () => void;
  /** The shell's opening line, given to a board that says it. */
  opening?: string | null;
  /** What this task's earlier steps in the run drew, oldest first. */
  drawn?: readonly number[];
  /** Adds an item to the task's memory for the rest of the run. */
  onDraw?: (item: number) => void;
};

export type Board = {
  Component: FC<BoardProps>;
  titleKey: string;
  /** The task's one-line description, as the picker shows it. */
  aboutKey: string;
  /** Takes reader focus as it opens, so it says the shell's opening line. */
  saysOpening?: boolean;
};

/** The board each task runs; the dhikr list's review picks its board and
 *  description. A task with no entry fails the build. */
export const taskBoards = (dhikrReviewed: boolean) =>
  ({
    [WAKE_TASK_ID.MATH]: {
      Component: MathBoard,
      titleKey: "alarm.task.title.math",
      aboutKey: WAKE_TASK_ABOUT_KEY.math,
    },
    [WAKE_TASK_ID.DHIKR]: dhikrReviewed
      ? {
          Component: DhikrBoard,
          titleKey: WAKE_TASK_NAME_KEY.dhikr,
          aboutKey: DHIKR_REVIEWED_ABOUT_KEY,
        }
      : {
          Component: DhikrChallenge,
          titleKey: WAKE_TASK_NAME_KEY.dhikr,
          aboutKey: WAKE_TASK_ABOUT_KEY.dhikr,
        },
    [WAKE_TASK_ID.TAP]: {
      Component: TapBoard,
      titleKey: WAKE_TASK_NAME_KEY.tap,
      aboutKey: WAKE_TASK_ABOUT_KEY.tap,
    },
    [WAKE_TASK_ID.PATTERN]: {
      Component: PatternBoard,
      titleKey: WAKE_TASK_NAME_KEY.pattern,
      aboutKey: WAKE_TASK_ABOUT_KEY.pattern,
      saysOpening: true,
    },
    [WAKE_TASK_ID.PRAYERS]: {
      Component: PrayersBoard,
      titleKey: WAKE_TASK_NAME_KEY.prayers,
      aboutKey: WAKE_TASK_ABOUT_KEY.prayers,
    },
  }) as const satisfies Record<WakeTaskId, Board>;

/** What an alarm and the picker run. */
export const TASK_BOARDS = taskBoards(DHIKR_TASK_REVIEWED);

/** Every board as reviewed, for a trial opened to check one under review. */
export const REVIEWED_BOARDS = taskBoards(true);

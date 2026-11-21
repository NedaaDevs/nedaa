import type { FC } from "react";

import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import MathChallenge from "@/components/alarm/challenges/MathChallenge";
import TapChallenge from "@/components/alarm/challenges/TapChallenge";
import { WAKE_TASK_ID, type WakeTaskId } from "@/constants/WakeTask";
import { WAKE_TASK_NAME_KEY } from "@/constants/WakeTaskShell";
import type { ChallengeDifficulty } from "@/types/alarm";

/** What the shell gives every board. */
export type BoardProps = { difficulty: ChallengeDifficulty; onComplete: () => void };

export type Board = { Component: FC<BoardProps>; titleKey: string };

const TAP_BOARD: Board = { Component: TapChallenge, titleKey: WAKE_TASK_NAME_KEY.tap };

/** The board each task runs; a task with no entry fails the build. */
export const TASK_BOARDS = {
  [WAKE_TASK_ID.MATH]: { Component: MathChallenge, titleKey: "alarm.task.title.math" },
  [WAKE_TASK_ID.DHIKR]: { Component: DhikrChallenge, titleKey: WAKE_TASK_NAME_KEY.dhikr },
  [WAKE_TASK_ID.TAP]: TAP_BOARD,
  // No board yet and no way to pick one; tap still asks to be awake.
  [WAKE_TASK_ID.PATTERN]: TAP_BOARD,
  [WAKE_TASK_ID.PRAYERS]: TAP_BOARD,
} as const satisfies Record<WakeTaskId, Board>;

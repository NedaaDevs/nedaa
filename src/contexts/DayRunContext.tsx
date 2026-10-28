import { createContext, use } from "react";

import type { DayRunKind, DayRunStatus } from "@/constants/DayRun";
import type { Phase } from "@/constants/Phase";

/** A day run, as the parts inside a `DaySimulator` drive and show it. */
export type DayRun = {
  kind: DayRunKind;
  status: DayRunStatus;
  /** The phase the run's clock is in; undefined while no run draws. */
  phase: Phase | undefined;
  /** How far the run is through its phases, 0 to 1; 0 in the prelude. */
  progress: number;
  /** False when the run has no whole day to play through. */
  available: boolean;
  start(): void;
  pause(): void;
  resume(): void;
  /** Moves the clock to the start of `phase` and holds it there. */
  jumpTo(phase: Phase): void;
  done(): void;
};

/** The run a `DaySimulator` provides; null outside one. */
export const DayRunContext = createContext<DayRun | null>(null);

/** The run of the nearest `DaySimulator`; null outside one. */
export const useDayRun = (): DayRun | null => use(DayRunContext);

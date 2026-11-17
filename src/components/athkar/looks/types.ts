import type { ComponentType, ReactNode } from "react";

import type { StepDirection } from "@/constants/AthkarFocus";
import type { AthkarSession } from "@/hooks/useAthkarSession";

/** What every look of the Athkar reader is given. A look draws; it holds no session state. */
export type AthkarLookProps = {
  session: AthkarSession;
  onOpenList: () => void;
  onOpenFocus: () => void;
  onStartAudio: () => void;
};

/** What every look's Focus stage is given: one dhikr, its count, gestures. */
export type AthkarFocusProps = {
  session: AthkarSession;
  /** The period's name, shown at the top. */
  period: string;
  /** The first-visit hint has been seen on this device. */
  hintSeen: boolean;
  onHintSeen: () => void;
  /** Moves one dhikr; the screen decides whether audio moves along. */
  onStep: (by: StepDirection) => void;
  /** The screen's two controls, placed by the look. */
  close: ReactNode;
  audio: ReactNode;
};

/** A look: the reader, and the same session's Focus stage. */
export type AthkarLook = {
  Reader: ComponentType<AthkarLookProps>;
  Focus: ComponentType<AthkarFocusProps>;
};

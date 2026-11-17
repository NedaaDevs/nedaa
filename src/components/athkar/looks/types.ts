import type { ComponentType, ReactNode } from "react";
import type { ParseKeys } from "i18next";

import type { StepDirection } from "@/constants/AthkarFocus";
import type { AthkarSession } from "@/hooks/useAthkarSession";

/** What every look of the Athkar reader is given. A look draws; it holds no session state. */
export type AthkarLookProps = {
  session: AthkarSession;
  onOpenList: () => void;
  onOpenFocus: () => void;
  onStartAudio: () => void;
  /** The look is being tried on: the dhikr and its count alone. */
  trying?: boolean;
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

/** A look: the reader and the same session's Focus stage. */
export type AthkarLook = {
  /** Locale key of the look's name. */
  name: ParseKeys;
  Reader: ComponentType<AthkarLookProps>;
  /** The reader draws a sun, so the page sky under it shows none. */
  drawsSun: boolean;
  Focus: ComponentType<AthkarFocusProps>;
  /** What Focus sits on in every state; without one, the route's sky. */
  FocusGround?: ComponentType<{ children: ReactNode }>;
};

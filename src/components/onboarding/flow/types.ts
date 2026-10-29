import type { RefObject } from "react";
import type { ViewInstance } from "react-native";

import {
  LOCATION_CHOICE,
  ONBOARDING_STEP,
  type LocationChoice,
  type OnboardingStepId,
} from "@/constants/Onboarding";

/** What the steps report during this session; the flow holds it. */
export type OnboardingSession = {
  languageRequested: boolean;
  /** Automatic, or a city a step stored; null until the user chooses. */
  locationChoice: LocationChoice | null;
  /** The prime saw a grant before the next permission read. */
  locationGranted: boolean;
  /** The fetch step has run; it keeps its place in the column. */
  fetchStarted: boolean;
};

export const NEW_SESSION: OnboardingSession = {
  languageRequested: false,
  locationChoice: null,
  locationGranted: false,
  fetchStarted: false,
};

/** The session a launch starts with: a resume on the prime keeps its choice. */
export const resumedSession = (saved: OnboardingStepId | null): OnboardingSession =>
  saved === ONBOARDING_STEP.LOCATION_PERMISSION
    ? { ...NEW_SESSION, locationChoice: LOCATION_CHOICE.AUTOMATIC }
    : NEW_SESSION;

/** A step's own primary action, drawn by the frame in place of Continue. */
export type StepPrimary = { label: string; onPress: () => void };

export type StepProps = {
  /** Moves on from this step, against the column of the next render. */
  onNext: () => void;
  /** Moves on like the frame's Skip: held while busy or step-locked. */
  onSkip: () => void;
  /** True holds back and skip until the step's request settles. */
  setBusy: (busy: boolean) => void;
  session: OnboardingSession;
  setSession: (patch: Partial<OnboardingSession>) => void;
  /** Null keeps the frame's Continue. */
  setPrimary: (primary: StepPrimary | null) => void;
  /** True hides the frame's primary for this step; Back stays. */
  setPrimaryHidden: (hidden: boolean) => void;
  /** A handler takes every back for this step; null gives it to the flow. */
  setBack: (handler: (() => void) | null) => void;
  /** Clears a manual city picked in this run; one stored before it stays. */
  dropTriedCity: () => void;
  /** The step's heading view; it takes reader focus when the step arrives. */
  headingRef: RefObject<ViewInstance | null>;
  /** The heading view's layout: the arrival's focus waits for it. */
  onHeadingLayout: () => void;
  /** "N of M", read with the heading; empty on Welcome and Completion. */
  progress: string;
};

import { createRef } from "react";
import type { View } from "react-native";

import { NEW_SESSION, type StepPrimary, type StepProps } from "@/components/onboarding/flow/types";

/** Step props whose callbacks are mocks; a test overrides what it reads. */
export const stepProps = (overrides: Partial<StepProps> = {}): StepProps => ({
  onNext: jest.fn(),
  onSkip: jest.fn(),
  setBusy: jest.fn(),
  session: NEW_SESSION,
  setSession: jest.fn(),
  setPrimary: jest.fn(),
  setPrimaryHidden: jest.fn(),
  setBack: jest.fn(),
  dropTriedCity: jest.fn(),
  headingRef: createRef<View>(),
  progress: "",
  ...overrides,
});

/** The primary a step last handed to the frame, or null. */
export const lastPrimary = (setPrimary: StepProps["setPrimary"]): StepPrimary | null =>
  jest.mocked(setPrimary).mock.lastCall?.[0] ?? null;

/** The back a step last claimed, or null when the flow holds it. */
export const lastBack = (setBack: StepProps["setBack"]): (() => void) | null =>
  jest.mocked(setBack).mock.lastCall?.[0] ?? null;

/** Whether the step last asked the frame to hide its primary. */
export const primaryHidden = (setPrimaryHidden: StepProps["setPrimaryHidden"]) =>
  jest.mocked(setPrimaryHidden).mock.lastCall?.[0] === true;

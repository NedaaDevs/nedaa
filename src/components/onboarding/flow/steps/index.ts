import type { ComponentType } from "react";

import { FajrAlarmStep, FridayAlarmStep } from "@/components/onboarding/flow/steps/AlarmStep";
import { AppearanceStep } from "@/components/onboarding/flow/steps/AppearanceStep";
import { CalculationStep } from "@/components/onboarding/flow/steps/CalculationStep";
import { CompleteStep } from "@/components/onboarding/flow/steps/CompleteStep";
import { FetchStep } from "@/components/onboarding/flow/steps/FetchStep";
import { LanguageStep } from "@/components/onboarding/flow/steps/LanguageStep";
import { LocationPermissionStep } from "@/components/onboarding/flow/steps/LocationPermissionStep";
import { LocationStep } from "@/components/onboarding/flow/steps/LocationStep";
import { NotificationsStep } from "@/components/onboarding/flow/steps/NotificationsStep";
import { NumeralsStep } from "@/components/onboarding/flow/steps/NumeralsStep";
import { TextSizeStep } from "@/components/onboarding/flow/steps/TextSizeStep";
import { UpgradeWelcomeStep } from "@/components/onboarding/flow/steps/UpgradeWelcomeStep";
import { WelcomeStep } from "@/components/onboarding/flow/steps/WelcomeStep";
import type { StepProps } from "@/components/onboarding/flow/types";
import { ONBOARDING_STEP as S, type OnboardingStepId } from "@/constants/Onboarding";

/** One component per step id; a Record keeps a missing step a build error. */
export const STEP_COMPONENT: Record<OnboardingStepId, ComponentType<StepProps>> = {
  [S.WELCOME]: WelcomeStep,
  [S.LANGUAGE]: LanguageStep,
  [S.NUMERALS]: NumeralsStep,
  [S.APPEARANCE]: AppearanceStep,
  [S.TEXT_SIZE]: TextSizeStep,
  [S.LOCATION]: LocationStep,
  [S.LOCATION_PERMISSION]: LocationPermissionStep,
  [S.FETCH]: FetchStep,
  [S.CALCULATION]: CalculationStep,
  [S.NOTIFICATIONS]: NotificationsStep,
  [S.FAJR_ALARM]: FajrAlarmStep,
  [S.FRIDAY_ALARM]: FridayAlarmStep,
  [S.COMPLETE]: CompleteStep,
  [S.UPGRADE_WELCOME]: UpgradeWelcomeStep,
  [S.UPGRADE_COMPLETE]: CompleteStep,
};

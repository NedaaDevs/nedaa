import { AppDirection, AppLocale, AppMode } from "@/enums/app";
import type { OnboardingStepId } from "@/constants/Onboarding";

export type AppState = {
  isFirstRun: boolean;
  /** The furthest first-run step reached; null outside onboarding. */
  onboardingStep: OnboardingStepId | null;
  setOnboardingStep: (step: OnboardingStepId) => void;
  hasHydrated: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  hijriDaysOffset: number;
  setIsFirstRun: (status: boolean) => void;
  /** Shows the first-run flow again from its first step. */
  restartOnboarding: () => void;
  setLocale: (lang: AppLocale) => void;
  setMode: (mode: AppMode) => void;
  setHijirOffset: (offset: number) => void;
  dismissedFeatureCards: string[];
  dismissFeatureCards: (ids: string[]) => void;
};

import { AppDirection, AppLocale, AppMode } from "@/enums/app";
import type { OnboardingStepId } from "@/constants/Onboarding";
import type { UpgradePathState } from "@/constants/UpgradePath";

export type AppState = {
  isFirstRun: boolean;
  /** The furthest first-run step reached; null outside onboarding. */
  onboardingStep: OnboardingStepId | null;
  setOnboardingStep: (step: OnboardingStepId) => void;
  /** Where a 2.x user stands on the walk through the V3 choices. */
  upgradePath: UpgradePathState;
  setUpgradePath: (state: UpgradePathState) => void;
  /** True once this launch has shown the upgrade prompt; never persisted. */
  upgradeShownThisLaunch: boolean;
  markUpgradeShown: () => void;
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

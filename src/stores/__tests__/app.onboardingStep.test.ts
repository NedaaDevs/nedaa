import { ONBOARDING_STEP } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";

describe("onboardingStep", () => {
  beforeEach(() => useAppStore.setState({ isFirstRun: true, onboardingStep: null }));

  it("starts empty", () => {
    expect(useAppStore.getInitialState().onboardingStep).toBeNull();
  });

  it("is kept across a restart", () => {
    useAppStore.getState().setOnboardingStep(ONBOARDING_STEP.FETCH);
    expect(useAppStore.persist.getOptions().partialize?.(useAppStore.getState())).toMatchObject({
      onboardingStep: ONBOARDING_STEP.FETCH,
    });
  });

  it("is cleared when the first run ends", () => {
    useAppStore.getState().setOnboardingStep(ONBOARDING_STEP.NOTIFICATIONS);
    useAppStore.getState().setIsFirstRun(false);
    expect(useAppStore.getState().onboardingStep).toBeNull();
  });
});

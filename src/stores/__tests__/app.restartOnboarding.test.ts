import { ONBOARDING_STEP } from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";

describe("restartOnboarding", () => {
  beforeEach(() =>
    useAppStore.setState({
      isFirstRun: false,
      onboardingStep: ONBOARDING_STEP.CALCULATION,
      locale: AppLocale.AR,
      dismissedFeatureCards: ["a-card"],
    })
  );

  it("starts the first run again from the first step", () => {
    useAppStore.getState().restartOnboarding();

    expect(useAppStore.getState().isFirstRun).toBe(true);
    expect(useAppStore.getState().onboardingStep).toBeNull();
  });

  it("saves both fields in one write", () => {
    const seen: { isFirstRun: boolean; onboardingStep: string | null }[] = [];
    const stop = useAppStore.subscribe((state) =>
      seen.push({ isFirstRun: state.isFirstRun, onboardingStep: state.onboardingStep })
    );

    useAppStore.getState().restartOnboarding();
    stop();

    expect(seen).toEqual([{ isFirstRun: true, onboardingStep: null }]);
  });

  it("leaves the app's other settings as they are", () => {
    useAppStore.getState().restartOnboarding();

    expect(useAppStore.getState().locale).toBe(AppLocale.AR);
    expect(useAppStore.getState().dismissedFeatureCards).toEqual(["a-card"]);
  });
});

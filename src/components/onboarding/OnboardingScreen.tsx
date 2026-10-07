import { useState, useCallback } from "react";
import { ActivityIndicator } from "react-native";

import { Box } from "@/components/ui/box";
import { useAppStore } from "@/stores/app";
import OnboardingDots from "./OnboardingDots";
import { useOnboardingSteps } from "./useOnboardingSteps";

const OnboardingScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { steps, loading } = useOnboardingSteps();
  const { setIsFirstRun } = useAppStore();

  // Advancing from a step is idempotent: a step may call onNext more than once.
  const handleNext = useCallback(() => {
    if (currentIndex === steps.length - 1) {
      setIsFirstRun(false);
      return;
    }
    setCurrentIndex((prev) => (prev === currentIndex ? currentIndex + 1 : prev));
  }, [currentIndex, steps.length, setIsFirstRun]);

  if (loading || steps.length === 0) {
    return (
      <Box flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" />
      </Box>
    );
  }

  const CurrentStep = steps[currentIndex].component;

  return (
    <Box flex={1} backgroundColor="$background">
      <Box flex={1} accessibilityLiveRegion="polite">
        <CurrentStep onNext={handleNext} />
      </Box>
      <OnboardingDots total={steps.length} current={currentIndex} />
    </Box>
  );
};

export default OnboardingScreen;

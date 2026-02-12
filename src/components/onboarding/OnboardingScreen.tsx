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

  const handleNext = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFirstRun(false);
    }
  }, [currentIndex, steps.length, setIsFirstRun]);

  if (loading || steps.length === 0) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </Box>
    );
  }

  const CurrentStep = steps[currentIndex].component;

  return (
    <Box className="flex-1 bg-background">
      <CurrentStep onNext={handleNext} />
      <OnboardingDots total={steps.length} current={currentIndex} />
    </Box>
  );
};

export default OnboardingScreen;

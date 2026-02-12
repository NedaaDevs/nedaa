import { useEffect, useState } from "react";
import { PermissionStatus } from "expo-notifications";

import { checkPermissions } from "@/utils/notifications";
import { checkLocationPermission } from "@/utils/location";

import WelcomeStep from "./steps/WelcomeStep";
import NotificationsStep from "./steps/NotificationsStep";
import LocationStep from "./steps/LocationStep";
import CrashReportingStep from "./steps/CrashReportingStep";

type OnboardingStepConfig = {
  id: "welcome" | "notifications" | "location" | "crashReporting";
  component: React.ComponentType<{ onNext: () => void }>;
};

const allSteps: {
  id: OnboardingStepConfig["id"];
  component: OnboardingStepConfig["component"];
  shouldShow: () => Promise<boolean>;
}[] = [
  {
    id: "welcome",
    component: WelcomeStep,
    shouldShow: async () => true,
  },
  {
    id: "notifications",
    component: NotificationsStep,
    shouldShow: async () => {
      const { status } = await checkPermissions();
      return status !== PermissionStatus.GRANTED;
    },
  },
  {
    id: "location",
    component: LocationStep,
    shouldShow: async () => {
      const { granted } = await checkLocationPermission();
      return !granted;
    },
  },
  {
    id: "crashReporting",
    component: CrashReportingStep,
    shouldShow: async () => true,
  },
];

export const useOnboardingSteps = () => {
  const [steps, setSteps] = useState<OnboardingStepConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buildSteps = async () => {
      const filtered: OnboardingStepConfig[] = [];

      for (const step of allSteps) {
        const show = await step.shouldShow();
        if (show) {
          filtered.push({ id: step.id, component: step.component });
        }
      }

      setSteps(filtered);
      setLoading(false);
    };

    buildSteps().catch((error) => {
      console.error("Failed to build onboarding steps:", error);
      setLoading(false);
    });
  }, []);

  return { steps, loading };
};

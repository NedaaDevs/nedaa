import { useEffect, useState } from "react";
import { usePathname } from "expo-router";
import * as Notifications from "expo-notifications";

import { isAlarmScreenPath } from "@/constants/Alarm";
import type { OnboardingPath } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";
import { onboardingPathFor } from "@/utils/onboardingPath";

/** The walk the gate opens; an alarm screen or a tap closes it for the launch. */
export const useOnboardingPath = (launchedByAlert: boolean): OnboardingPath | null => {
  const isFirstRun = useAppStore((state) => state.isFirstRun);
  const upgradePath = useAppStore((state) => state.upgradePath);
  const pathname = usePathname();
  // Latched while rendering: once seen, it holds until the app restarts.
  const [alarmScreenSeen, setAlarmScreenSeen] = useState(false);
  if (!alarmScreenSeen && isAlarmScreenPath(pathname)) setAlarmScreenSeen(true);
  // A tap opens its own screen, the cold-launch tap included when it is late.
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() =>
      setTapped(true)
    );
    return () => subscription.remove();
  }, []);
  return onboardingPathFor({
    isFirstRun,
    upgradePath,
    launchedByAlert: launchedByAlert || tapped,
    alarmScreenSeen,
  });
};

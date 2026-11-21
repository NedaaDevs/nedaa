import { useState } from "react";
import { useIsFocused } from "expo-router";

import { usePersistHydrated } from "@/hooks/usePersistHydrated";
import { useAlarmGuideStore } from "@/stores/alarmGuide";

// Opens by itself once, then on request; only while its screen is focused.
// Any close counts as seen, a close from leaving the screen included.
export const useAlarmGuide = () => {
  const focused = useIsFocused();
  const hydrated = usePersistHydrated(useAlarmGuideStore.persist);
  const seen = useAlarmGuideStore((state) => state.hasSeenGuide);
  const markGuideSeen = useAlarmGuideStore((state) => state.markGuideSeen);
  const [asked, setAsked] = useState(false);

  return {
    open: focused && (asked || (hydrated && !seen)),
    show: () => setAsked(true),
    close: () => {
      setAsked(false);
      markGuideSeen();
    },
  };
};

import { useCallback, useMemo } from "react";

import { getUnseenEntries } from "@/constants/WhatsNew";
import { useAppStore } from "@/stores/app";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { readPendingReport } from "@/utils/crashHandler";

// Present condition for the What's New sheet: an existing (post-onboarding)
// user with unseen announcements. The crash-report prompt takes priority —
// if one is pending, What's New waits for a later launch.
export const useWhatsNew = () => {
  const { isFirstRun, hasHydrated, quranUnlocked, dismissedFeatureCards, dismissFeatureCards } =
    useAppStore();
  const umrahInProgress = useUmrahGuideStore((s) => !!s.activeProgress);

  const entries = useMemo(
    () => getUnseenEntries(dismissedFeatureCards, { quranUnlocked, umrahInProgress }),
    [dismissedFeatureCards, quranUnlocked, umrahInProgress]
  );

  const shouldPresent =
    hasHydrated && !isFirstRun && entries.length > 0 && readPendingReport() === null;

  const markAllSeen = useCallback(() => {
    dismissFeatureCards(entries.map((e) => e.id));
  }, [dismissFeatureCards, entries]);

  const markSeen = useCallback(
    (id: string) => {
      dismissFeatureCards([id]);
    },
    [dismissFeatureCards]
  );

  return { entries, shouldPresent, markAllSeen, markSeen };
};

import { useCallback, useMemo } from "react";
import { PixelRatio } from "react-native";

import { getApplicableEntries, getUnseenEntries } from "@/constants/WhatsNew";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { readPendingReport } from "@/utils/crashHandler";

// Present condition for the What's New sheet: an existing (post-onboarding)
// user with unseen announcements. The crash-report prompt takes priority —
// if one is pending, What's New waits for a later launch.
export const useWhatsNew = () => {
  const { isFirstRun, hasHydrated, dismissedFeatureCards, dismissFeatureCards } = useAppStore();
  const umrahInProgress = useUmrahGuideStore((s) => !!s.activeProgress);
  const textSizeOfferHandled = usePreferencesStore((s) => s.textSizeOfferHandled);

  const ctx = useMemo(
    () => ({ umrahInProgress, fontScale: PixelRatio.getFontScale(), textSizeOfferHandled }),
    [umrahInProgress, textSizeOfferHandled]
  );

  const entries = useMemo(
    () => getUnseenEntries(dismissedFeatureCards, ctx),
    [dismissedFeatureCards, ctx]
  );

  // Opening from Settings shows every applicable entry, seen or not — the
  // unseen set is empty for anyone who already dismissed the sheet.
  const allEntries = useMemo(() => getApplicableEntries(ctx), [ctx]);

  const shouldPresent =
    hasHydrated && !isFirstRun && entries.length > 0 && readPendingReport() === null;

  const markSeen = useCallback(
    (ids: string[]) => {
      dismissFeatureCards(ids);
    },
    [dismissFeatureCards]
  );

  return { entries, allEntries, shouldPresent, markSeen };
};

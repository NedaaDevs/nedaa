import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HostInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { Actionsheet, ActionsheetContent, ActionsheetTitle } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ReleaseNotesList } from "@/components/whats-new/ReleaseNotesList";
import { VersionPill } from "@/components/whats-new/VersionPill";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { useWhatsNewSheetStore } from "@/stores/whatsNewSheet";
import { WHATS_NEW_ACTION, type WhatsNewEntry } from "@/constants/WhatsNew";
import { appVersion } from "@/utils/appVersion";

// Let Home paint (prayer times) before the sheet slides up.
export const PRESENT_DELAY_MS = 800;

// Auto-presents once after an update for users with unseen announcements, and
// on request from About. Any dismissal marks everything shown as seen.
const WhatsNewSheet = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const presented = useRef(false);
  // Navigate actions mark only their own entry; the rest of the wave returns
  // on a later launch instead of being swept as seen.
  const navigating = useRef(false);
  const { entries, allEntries, shouldPresent, markSeen } = useWhatsNew();
  const openRequests = useWhatsNewSheetStore((s) => s.openRequests);
  const clearOpener = useWhatsNewSheetStore((s) => s.clearOpener);
  // Held past close: the sheet hands focus back once gorhom reports it gone.
  const [opener, setOpener] = useState<RefObject<HostInstance | null>>();
  // List frozen at present time so rows don't vanish when the seen-set updates.
  const [shownEntries, setShownEntries] = useState<WhatsNewEntry[]>([]);

  const allEntriesRef = useRef(allEntries);
  useEffect(() => {
    allEntriesRef.current = allEntries;
  }, [allEntries]);

  useEffect(() => {
    if (IS_SCREENSHOT_MODE || presented.current || !shouldPresent) return;
    // The guard is armed when the sheet actually shows: a change to the entry
    // list mid-delay cancels this timer, and the effect must re-arm it.
    const timer = setTimeout(() => {
      presented.current = true;
      setOpener(undefined);
      setShownEntries(entries);
      setOpen(true);
    }, PRESENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shouldPresent, entries]);

  // Opened from About: the full list, with no delay. Tracking the request
  // count keeps a remount of this component from re-presenting on its own.
  const handledRequests = useRef(openRequests);
  useEffect(() => {
    if (openRequests === handledRequests.current) return;
    handledRequests.current = openRequests;
    setOpener(useWhatsNewSheetStore.getState().opener ?? undefined);
    setShownEntries(allEntriesRef.current);
    setOpen(true);
  }, [openRequests]);

  const handleNavigate = useCallback(
    (entry: WhatsNewEntry) => {
      if (entry.action.type !== WHATS_NEW_ACTION.NAVIGATE) return;
      markSeen([entry.id]);
      navigating.current = true;
      setOpen(false);
      router.push(entry.action.route);
    },
    [markSeen, router]
  );

  // Enable / Not now settle a row in place; the sheet stays open.
  const handleSettled = useCallback(
    (entry: WhatsNewEntry) => {
      markSeen([entry.id]);
    },
    [markSeen]
  );

  // Swipe, backdrop, or Done dismisses the wave: everything shown is seen.
  // A navigate exit marks only its own entry — the rest returns next launch.
  const handleClose = useCallback(() => {
    setOpen(false);
    clearOpener();
    if (navigating.current) {
      navigating.current = false;
      return;
    }
    markSeen(shownEntries.map((e) => e.id));
  }, [markSeen, shownEntries, clearOpener]);

  return (
    <Actionsheet isOpen={open} onClose={handleClose} fitContent finalFocusRef={opener}>
      <ActionsheetContent>
        <VStack gap="$4">
          <VStack alignItems="center" gap="$1">
            <IconTile icon={Sparkles} />
            <ActionsheetTitle>
              <Text size="md" bold typography="title" color="$fg" textAlign="center">
                {t("whatsNew.title")}
              </Text>
            </ActionsheetTitle>
            <Box accessible accessibilityLabel={t("a11y.about.version", { version: appVersion() })}>
              <VersionPill />
            </Box>
          </VStack>

          <ReleaseNotesList
            entries={shownEntries}
            onNavigate={handleNavigate}
            onSettled={handleSettled}
          />

          <Button
            action="primary"
            size="lg"
            width="100%"
            marginTop="$1"
            onPress={() => setOpen(false)}
            accessibilityLabel={t("whatsNew.done")}>
            <Button.Text>{t("whatsNew.done")}</Button.Text>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default WhatsNewSheet;

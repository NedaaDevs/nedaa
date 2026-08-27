import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";
import { Sparkles } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import WhatsNewEntryRow from "@/components/WhatsNewEntryRow";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { useWhatsNewSheetStore } from "@/stores/whatsNewSheet";
import type { WhatsNewEntry } from "@/constants/WhatsNew";

// Let Home paint (prayer times) before the sheet slides up.
const PRESENT_DELAY_MS = 800;

// Auto-presents once after an update for users with unseen announcements, and
// on request from Settings. Any dismissal marks everything shown as seen.
const WhatsNewSheet = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ref = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  // Navigate actions mark only their own entry; the rest of the wave returns
  // on a later launch instead of being swept as seen.
  const navigating = useRef(false);
  const { entries, allEntries, shouldPresent, markSeen } = useWhatsNew();
  const openRequests = useWhatsNewSheetStore((s) => s.openRequests);
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
      setShownEntries(entries);
      ref.current?.present();
    }, PRESENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shouldPresent, entries]);

  // Opened from Settings: the full list, with no delay. Tracking the request
  // count keeps a remount of this component from re-presenting on its own.
  const handledRequests = useRef(openRequests);
  useEffect(() => {
    if (openRequests === handledRequests.current) return;
    handledRequests.current = openRequests;
    setShownEntries(allEntriesRef.current);
    ref.current?.present();
  }, [openRequests]);

  const handleNavigate = useCallback(
    (entry: WhatsNewEntry) => {
      if (entry.action.type !== "navigate") return;
      markSeen([entry.id]);
      navigating.current = true;
      ref.current?.dismiss();
      router.push(entry.action.route as any);
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

  const handleDone = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  // Swipe, backdrop, or Done dismisses the wave: everything shown is seen.
  // A navigate exit marks only its own entry — the rest returns next launch.
  const onDismiss = useCallback(() => {
    if (navigating.current) {
      navigating.current = false;
      return;
    }
    markSeen(shownEntries.map((e) => e.id));
  }, [markSeen, shownEntries]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const version = Constants.expoConfig?.version;

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.typographySecondary?.val ?? theme.outline?.val,
      }}>
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}>
        <VStack gap="$4">
          <VStack gap="$1" alignItems="center">
            <Icon as={Sparkles} size="lg" color="$accentPrimary" />
            <Text size="lg" fontWeight="700" color="$typography" accessibilityRole="header">
              {t("whatsNew.title")}
            </Text>
            {version && (
              <Text size="xs" color="$typographySecondary">
                {t("whatsNew.subtitle", { version })}
              </Text>
            )}
          </VStack>

          {shownEntries.map((entry) => (
            <WhatsNewEntryRow
              key={entry.id}
              entry={entry}
              onNavigate={handleNavigate}
              onSettled={handleSettled}
            />
          ))}

          <Button
            onPress={handleDone}
            width="100%"
            accessibilityRole="button"
            accessibilityLabel={t("whatsNew.done")}>
            <Button.Text>{t("whatsNew.done")}</Button.Text>
          </Button>
        </VStack>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export default WhatsNewSheet;

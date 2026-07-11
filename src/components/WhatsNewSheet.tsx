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
import { Check, Sparkles } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import type { WhatsNewEntry } from "@/constants/WhatsNew";

// Let Home paint (prayer times) before the sheet slides up.
const PRESENT_DELAY_MS = 800;

type EntryRowProps = {
  entry: WhatsNewEntry;
  onNavigate: (entry: WhatsNewEntry) => void;
  // Row settled in place (enabled or declined) — sheet stays open.
  onSettled: (entry: WhatsNewEntry) => void;
};

const EntryRow = ({ entry, onNavigate, onSettled }: EntryRowProps) => {
  const { t } = useTranslation();
  const { action } = entry;
  const [enabled, setEnabled] = useState(action.type === "optIn" ? action.isEnabled() : false);
  const [declined, setDeclined] = useState(false);

  const handleEnable = () => {
    if (action.type !== "optIn" || enabled) return;
    action.enable();
    setEnabled(true);
    onSettled(entry);
  };

  const handleDecline = () => {
    setDeclined(true);
    onSettled(entry);
  };

  return (
    <HStack gap="$3" alignItems="flex-start">
      <Box
        width={40}
        height={40}
        borderRadius="$3"
        backgroundColor="$backgroundInteractive"
        alignItems="center"
        justifyContent="center">
        <Icon as={entry.icon} size="md" color="$accentPrimary" />
      </Box>
      <VStack flex={1} gap="$1">
        <Text size="sm" fontWeight="600" color="$typography">
          {t(entry.titleKey)}
        </Text>
        <Text size="xs" color="$typographySecondary" lineHeight={18}>
          {t(entry.descriptionKey)}
        </Text>

        {action.type === "navigate" ? (
          <Pressable
            onPress={() => onNavigate(entry)}
            minHeight={44}
            justifyContent="center"
            alignSelf="flex-start"
            accessibilityRole="button"
            accessibilityLabel={t(action.ctaKey)}>
            <Text size="sm" fontWeight="600" color="$accentPrimary">
              {t(action.ctaKey)}
            </Text>
          </Pressable>
        ) : declined ? (
          <Text size="sm" color="$typographySecondary" paddingVertical="$2">
            {t("whatsNew.notNow")}
          </Text>
        ) : (
          <HStack gap="$4" alignItems="center">
            <Pressable
              onPress={handleEnable}
              minHeight={44}
              minWidth={44}
              paddingHorizontal="$4"
              justifyContent="center"
              alignItems="center"
              borderRadius="$3"
              backgroundColor={enabled ? "$backgroundInteractive" : "$accentPrimary"}
              accessibilityRole="button"
              accessibilityLabel={t(enabled ? "whatsNew.enabled" : action.ctaKey)}
              accessibilityState={{ selected: enabled, disabled: enabled }}>
              <HStack gap="$1.5" alignItems="center">
                {enabled && <Icon as={Check} size="sm" color="$accentPrimary" />}
                <Text size="sm" fontWeight="600" color={enabled ? "$accentPrimary" : "white"}>
                  {t(enabled ? "whatsNew.enabled" : action.ctaKey)}
                </Text>
              </HStack>
            </Pressable>
            {!enabled && (
              <Pressable
                onPress={handleDecline}
                minHeight={44}
                justifyContent="center"
                accessibilityRole="button"
                accessibilityLabel={t("whatsNew.notNow")}>
                <Text size="sm" color="$typographySecondary">
                  {t("whatsNew.notNow")}
                </Text>
              </Pressable>
            )}
          </HStack>
        )}
      </VStack>
    </HStack>
  );
};

// Auto-presents once after an update for users with unseen announcements.
// Any dismissal marks everything shown as seen — one sheet per update wave.
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
  const { entries, shouldPresent, markAllSeen, markSeen } = useWhatsNew();
  // List frozen at present time so rows don't vanish when the seen-set updates.
  const [shownEntries, setShownEntries] = useState<WhatsNewEntry[]>([]);

  useEffect(() => {
    if (IS_SCREENSHOT_MODE || presented.current || !shouldPresent) return;
    presented.current = true;
    const timer = setTimeout(() => {
      setShownEntries(entries);
      ref.current?.present();
    }, PRESENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shouldPresent, entries]);

  const handleNavigate = useCallback(
    (entry: WhatsNewEntry) => {
      if (entry.action.type !== "navigate") return;
      markSeen(entry.id);
      navigating.current = true;
      ref.current?.dismiss();
      router.push(entry.action.route as any);
    },
    [markSeen, router]
  );

  // Enable / Not now settle a row in place; the sheet stays open.
  const handleSettled = useCallback(
    (entry: WhatsNewEntry) => {
      markSeen(entry.id);
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
    markAllSeen();
  }, [markAllSeen]);

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
            <EntryRow
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

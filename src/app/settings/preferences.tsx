import { useRef } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ChevronLeft, ChevronRight, Info } from "lucide-react-native";

import { useRTL } from "@/contexts/RTLContext";

// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { InfoSheet } from "@/components/InfoSheet";
import SettingsToggleRow from "@/components/settings/SettingsToggleRow";
import SettingsChoiceRow from "@/components/settings/SettingsChoiceRow";

// Stores
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Enums
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { OpeningTab } from "@/enums/app";

const PreferencesSettings = () => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const { locale } = useAppStore();
  const {
    useWesternNumerals,
    setUseWesternNumerals,
    use24HourTime,
    setUse24HourTime,
    openingTab,
    setOpeningTab,
    showSeconds,
    setShowSeconds,
    hapticsEnabled,
    setHapticsEnabled,
    largeControls,
    setLargeControls,
    showImportantDaysOnHome,
    setShowImportantDaysOnHome,
    shareUsageStats,
    setShareUsageStats,
  } = usePreferencesStore();

  const usageInfoRef = useRef<BottomSheetModal>(null);

  const isArabic = locale.startsWith("ar");

  // Only offer tabs this user can actually reach — Athkar depends on locale and
  // Quran on the unlock, and both are hidden from the tab bar when unavailable.
  const openingTabOptions = [
    { value: OpeningTab.HOME, labelKey: "a11y.tab.home" },
    ...(isAthkarSupported(locale)
      ? [{ value: OpeningTab.ATHKAR, labelKey: "a11y.tab.athkar" }]
      : []),
    { value: OpeningTab.QURAN, labelKey: "a11y.tab.quran" },
    { value: OpeningTab.TOOLS, labelKey: "a11y.tab.tools" },
  ];

  return (
    <Background>
      <ScreenHeader title={t("settings.preferences.title")} back />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <VStack padding="$4" gap="$4">
          {/* Western Numerals - only show for Arabic locale */}
          {isArabic && (
            <SettingsToggleRow
              titleKey="settings.preferences.westernNumerals.title"
              descriptionKey="settings.preferences.westernNumerals.description"
              value={useWesternNumerals}
              onValueChange={setUseWesternNumerals}
            />
          )}

          <SettingsChoiceRow
            titleKey="settings.preferences.openingTab.title"
            descriptionKey="settings.preferences.openingTab.description"
            value={openingTab}
            onChange={setOpeningTab}
            options={openingTabOptions}
          />

          <SettingsToggleRow
            titleKey="settings.preferences.use24HourTime.title"
            descriptionKey="settings.preferences.use24HourTime.description"
            value={use24HourTime}
            onValueChange={setUse24HourTime}
          />

          <SettingsToggleRow
            titleKey="settings.preferences.seconds.title"
            descriptionKey="settings.preferences.seconds.description"
            value={showSeconds}
            onValueChange={setShowSeconds}
          />

          <SettingsToggleRow
            titleKey="settings.preferences.haptics.title"
            descriptionKey="settings.preferences.haptics.description"
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
          />

          {/* Only affects the Quran reader's scroll and audio controls. */}
          <SettingsToggleRow
            titleKey="settings.preferences.largeControls.title"
            descriptionKey="settings.preferences.largeControls.description"
            value={largeControls}
            onValueChange={setLargeControls}
          />

          <Pressable
            onPress={() => router.push(BACK_DESTINATION.SETTINGS_TEXT_SIZE.href)}
            accessibilityRole="button"
            accessibilityLabel={t("settings.textSize.title")}
            accessibilityHint={t("a11y.settingsItemNav", { name: t("settings.textSize.title") })}
            minHeight={44}
            paddingVertical="$3">
            <HStack alignItems="center" justifyContent="space-between" gap="$3">
              <VStack flexShrink={1} gap="$0.5">
                <Text size="md" fontWeight="600">
                  {t("settings.textSize.title")}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {t("settings.textSize.description")}
                </Text>
              </VStack>
              <Icon
                size="lg"
                color="$typographySecondary"
                as={isRTL ? ChevronLeft : ChevronRight}
              />
            </HStack>
          </Pressable>

          <SettingsToggleRow
            titleKey="settings.preferences.importantDays.title"
            descriptionKey="settings.preferences.importantDays.description"
            value={showImportantDaysOnHome}
            onValueChange={setShowImportantDaysOnHome}
          />

          {/* Usage stats — keep this row LAST; add new preferences above it.
              Detail lives in the info sheet (tap the ⓘ), not inline. */}
          <SettingsToggleRow
            titleKey="settings.preferences.usageStats.title"
            value={shareUsageStats}
            onValueChange={setShareUsageStats}
            titleAccessory={
              // Override the 44×44 tap-target minimums so the icon sizes to
              // itself and centers with the title; hitSlop keeps it tappable.
              <Pressable
                minWidth={0}
                minHeight={0}
                alignSelf="center"
                flexShrink={0}
                onPress={() => usageInfoRef.current?.present()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("settings.preferences.usageStats.title")}>
                <Icon as={Info} size="sm" color="$typographySecondary" />
              </Pressable>
            }
          />
        </VStack>
        <InfoSheet
          ref={usageInfoRef}
          titleKey="settings.preferences.usageStats.title"
          bodyKey="settings.preferences.usageStats.body"
        />
      </ScrollView>
    </Background>
  );
};

export default PreferencesSettings;

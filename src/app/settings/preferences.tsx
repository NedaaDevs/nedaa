import { useRef } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Info } from "lucide-react-native";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
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
import { formatNumberToLocale } from "@/utils/number";
import { isAthkarSupported } from "@/utils/athkar";

// Enums
import { OpeningTab } from "@/enums/app";

const DurationPicker = ({
  value,
  onChange,
  options,
  labelKey,
}: {
  value: number;
  onChange: (value: number) => void;
  options: number[];
  labelKey: string;
}) => {
  const { t } = useTranslation();

  return (
    <HStack backgroundColor="$backgroundMuted" borderRadius="$4" padding="$1">
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            flex={1}
            paddingVertical="$2"
            borderRadius="$3"
            backgroundColor={isSelected ? "$primary" : "transparent"}
            alignItems="center"
            justifyContent="center"
            minHeight={36}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={formatNumberToLocale(t(labelKey, { count: option }))}>
            <Text
              size="sm"
              color={isSelected ? "$typographyContrast" : "$typography"}
              fontWeight={isSelected ? "600" : "400"}>
              {formatNumberToLocale(t(labelKey, { count: option }))}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
};

const PreferencesSettings = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  // TODO(quran-gate): remove at 2.10.0
  const quranUnlocked = useAppStore((s) => s.quranUnlocked);
  const {
    useWesternNumerals,
    setUseWesternNumerals,
    use24HourTime,
    setUse24HourTime,
    openingTab,
    setOpeningTab,
    countdownEnabled,
    setCountdownEnabled,
    countdownMinutes,
    setCountdownMinutes,
    iqamaCountUpEnabled,
    setIqamaCountUpEnabled,
    iqamaCountUpMinutes,
    setIqamaCountUpMinutes,
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
    // TODO(quran-gate): drop the condition at 2.10.0 (feature public).
    ...(quranUnlocked ? [{ value: OpeningTab.QURAN, labelKey: "a11y.tab.quran" }] : []),
    { value: OpeningTab.TOOLS, labelKey: "a11y.tab.tools" },
  ];

  return (
    <Background>
      <TopBar title="settings.preferences.title" backOnClick />
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
            titleKey="settings.preferences.countdown.title"
            descriptionKey="settings.preferences.countdown.description"
            value={countdownEnabled}
            onValueChange={setCountdownEnabled}>
            {countdownEnabled && (
              <DurationPicker
                value={countdownMinutes}
                onChange={setCountdownMinutes}
                options={[15, 30, 45, 60]}
                labelKey="settings.preferences.countdown.minutes"
              />
            )}
          </SettingsToggleRow>

          <SettingsToggleRow
            titleKey="settings.preferences.iqamaCountUp.title"
            descriptionKey="settings.preferences.iqamaCountUp.description"
            value={iqamaCountUpEnabled}
            onValueChange={setIqamaCountUpEnabled}>
            {iqamaCountUpEnabled && (
              <DurationPicker
                value={iqamaCountUpMinutes}
                onChange={setIqamaCountUpMinutes}
                options={[10, 15, 20, 30]}
                labelKey="settings.preferences.iqamaCountUp.minutes"
              />
            )}
          </SettingsToggleRow>

          <SettingsToggleRow
            titleKey="settings.preferences.haptics.title"
            descriptionKey="settings.preferences.haptics.description"
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
          />

          {/* Only affects the Quran reader's scroll and audio controls, so it is
              hidden until the reader is available.
              TODO(quran-gate): drop the condition at 2.10.0 (feature public). */}
          {quranUnlocked && (
            <SettingsToggleRow
              titleKey="settings.preferences.largeControls.title"
              descriptionKey="settings.preferences.largeControls.description"
              value={largeControls}
              onValueChange={setLargeControls}
            />
          )}

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

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Shield } from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";

import { FocusCountdown } from "@/components/today/FocusCountdown";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { SwitchGroup } from "@/components/ui/switch-group";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { CLOCK_FORMAT, NUMERAL_STYLE } from "@/constants/Preferences";
import { SECTION_KIND } from "@/constants/Section";
import { tabItem } from "@/constants/TabBar";
import { OpeningTab } from "@/enums/app";
import { useBarTabs } from "@/hooks/useBarTabs";
import { useHaptic } from "@/hooks/useHaptic";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";

const CLOCK_FORMATS = Object.values(CLOCK_FORMAT);
const NUMERAL_STYLES = Object.values(NUMERAL_STYLE);
const GROUPED = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

type ChoiceSettingProps = { title: string; summary: string; children: ReactNode };

/** A grouped row naming a setting, with its choice at the row's end. */
const ChoiceSetting = ({ title, summary, children }: ChoiceSettingProps) => (
  <HStack alignItems="center" gap="$3" {...GROUPED.frame}>
    <VStack flex={1}>
      <Text {...GROUPED.title} color="$fg">
        {title}
      </Text>
      <Text {...GROUPED.status} color="$muted">
        {summary}
      </Text>
    </VStack>
    {children}
  </HStack>
);

const PreferencesScreen = () => (
  <SkyBackground>
    <PreferencesContent />
  </SkyBackground>
);

export default PreferencesScreen;

/** The screen over its sky, headed by the countdown its seconds switch sets. */
const PreferencesContent = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectionHaptic = useHaptic("selection");
  const locale = useAppStore((state) => state.locale);
  const tabs = useBarTabs();
  const preferences = usePreferencesStore(
    useShallow((state) => ({
      showSeconds: state.showSeconds,
      setShowSeconds: state.setShowSeconds,
      use24HourTime: state.use24HourTime,
      setUse24HourTime: state.setUse24HourTime,
      useWesternNumerals: state.useWesternNumerals,
      setUseWesternNumerals: state.setUseWesternNumerals,
      showImportantDaysOnHome: state.showImportantDaysOnHome,
      setShowImportantDaysOnHome: state.setShowImportantDaysOnHome,
      openingTab: state.openingTab,
      setOpeningTab: state.setOpeningTab,
      hapticsEnabled: state.hapticsEnabled,
      setHapticsEnabled: state.setHapticsEnabled,
      textSize: state.textSize,
      shareUsageStats: state.shareUsageStats,
      setShareUsageStats: state.setShareUsageStats,
    }))
  );
  // A tab chosen in another locale may be off the bar; the app opens on Home then.
  const opening =
    tabs.find((tab) => tab.name === preferences.openingTab) ?? tabItem(OpeningTab.HOME);

  const linkRow = (destination: BackDestination, status?: string) => (
    <ListRow
      variant={LIST_ROW_VARIANT.GROUPED}
      title={t(destination.title)}
      status={status}
      hint={t("a11y.opens", { name: t(destination.title) })}
      onPress={async () => {
        await selectionHaptic();
        router.push(destination.href);
      }}
    />
  );

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t("settings.preferences.title")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
      </SkyOccluder>

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
        <FocusCountdown />

        <SkyOccluder>
          <VStack gap="$5">
            <Section
              title={t("settings.preferences.sections.prayerTime")}
              kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <SwitchGroup
                  variant={LIST_ROW_VARIANT.GROUPED}
                  label={t("settings.preferences.seconds.title")}
                  summary={t("settings.preferences.seconds.description")}
                  value={preferences.showSeconds}
                  onValueChange={preferences.setShowSeconds}
                />
              </ListGroup>
            </Section>

            <Section title={t("settings.preferences.sections.display")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <ChoiceSetting
                  title={t("settings.preferences.clock.title")}
                  summary={t("settings.preferences.clock.description")}>
                  <SegmentedChoice
                    options={CLOCK_FORMATS}
                    value={
                      preferences.use24HourTime
                        ? CLOCK_FORMAT.TWENTY_FOUR_HOUR
                        : CLOCK_FORMAT.TWELVE_HOUR
                    }
                    onChange={(format) =>
                      preferences.setUse24HourTime(format === CLOCK_FORMAT.TWENTY_FOUR_HOUR)
                    }
                    accessibilityLabel={t("settings.preferences.clock.title")}
                    label={(format) => t(`settings.preferences.clock.options.${format}`)}
                    spokenLabel={(format) => t(`settings.preferences.clock.spoken.${format}`)}
                  />
                </ChoiceSetting>
                {/* Only Arabic writes numbers in digits of its own. */}
                {locale.startsWith("ar") ? (
                  <ChoiceSetting
                    title={t("settings.preferences.numerals.title")}
                    summary={t("settings.preferences.numerals.description")}>
                    <SegmentedChoice
                      options={NUMERAL_STYLES}
                      value={
                        preferences.useWesternNumerals
                          ? NUMERAL_STYLE.WESTERN
                          : NUMERAL_STYLE.ARABIC
                      }
                      onChange={(style) =>
                        preferences.setUseWesternNumerals(style === NUMERAL_STYLE.WESTERN)
                      }
                      accessibilityLabel={t("settings.preferences.numerals.title")}
                      label={(style) => t(`settings.preferences.numerals.options.${style}`)}
                      spokenLabel={(style) => t(`settings.preferences.numerals.spoken.${style}`)}
                      literalDigits
                    />
                  </ChoiceSetting>
                ) : null}
                <SwitchGroup
                  variant={LIST_ROW_VARIANT.GROUPED}
                  label={t("settings.preferences.importantDays.title")}
                  summary={t("settings.preferences.importantDays.description")}
                  value={preferences.showImportantDaysOnHome}
                  onValueChange={preferences.setShowImportantDaysOnHome}
                />
              </ListGroup>
            </Section>

            <Section title={t("settings.preferences.sections.start")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <VStack gap="$3" {...GROUPED.frame}>
                  <HStack alignItems="center" justifyContent="space-between" gap="$3">
                    <Text {...GROUPED.title} color="$fg" flexShrink={1}>
                      {t("settings.preferences.openingTab.title")}
                    </Text>
                    {/* The chosen tile says it to a screen reader. */}
                    <Text
                      {...GROUPED.status}
                      color="$muted"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants">
                      {t(opening.title)}
                    </Text>
                  </HStack>
                  <SegmentedChoice
                    options={tabs.map((tab) => tab.name)}
                    value={opening.name}
                    onChange={preferences.setOpeningTab}
                    accessibilityLabel={t("settings.preferences.openingTab.title")}
                    label={(name) => t(tabItem(name).title)}
                    icon={(name) => tabItem(name).icon}
                  />
                </VStack>
              </ListGroup>
            </Section>

            <Section title={t("settings.preferences.sections.comfort")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <SwitchGroup
                  variant={LIST_ROW_VARIANT.GROUPED}
                  label={t("settings.preferences.haptics.title")}
                  summary={t("settings.preferences.haptics.description")}
                  value={preferences.hapticsEnabled}
                  onValueChange={preferences.setHapticsEnabled}
                />
                {linkRow(
                  BACK_DESTINATION.SETTINGS_TEXT_SIZE,
                  t(`settings.textSize.options.${preferences.textSize}`)
                )}
              </ListGroup>
            </Section>

            <Section title={t("settings.privacy.title")} kind={SECTION_KIND.LABEL}>
              <ListGroup>
                <SwitchGroup
                  variant={LIST_ROW_VARIANT.GROUPED}
                  label={t("settings.preferences.usageStats.title")}
                  value={preferences.shareUsageStats}
                  onValueChange={preferences.setShareUsageStats}
                />
                {linkRow(BACK_DESTINATION.SETTINGS_PRIVACY)}
              </ListGroup>
              {/* Sits on the sky, so its text takes the sky's muted tone. */}
              <HStack
                alignItems="flex-start"
                gap="$2"
                paddingVertical="$2.5"
                paddingHorizontal="$3"
                borderWidth={1}
                borderStyle="dashed"
                borderColor="$border"
                borderRadius="$card">
                <Icon as={Shield} size="sm" color="$accent" />
                <Text size="sm" color="$mutedSky" flex={1}>
                  {t("settings.privacy.usage.what")}
                </Text>
              </HStack>
            </Section>
          </VStack>
        </SkyOccluder>
      </VStack>
    </SkyScrollView>
  );
};

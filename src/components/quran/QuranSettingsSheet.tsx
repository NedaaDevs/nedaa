import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Bookmark, ChevronDown, ChevronUp, Download, Minus, Plus, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus, SurahFrameStyle, ReaderViewMode } from "@/enums/quran";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import {
  Section,
  SettingRow,
  Segmented,
  Stepper,
} from "@/components/quran/settings/SettingsControls";
import ReadingThemeSwatches from "@/components/quran/settings/ReadingThemeSwatches";
import LibraryRow from "@/components/quran/settings/LibraryRow";

interface QuranSettingsSheetProps {
  onClose: () => void;
  onDownloadMore: () => void;
}

const QuranSettingsSheet = ({ onClose, onDownloadMore }: QuranSettingsSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  const {
    versionDownloads,
    surahFrameStyle,
    readerMode,
    fontSize,
    setSurahFrameStyle,
    setReaderMode,
    setFontSize,
  } = useQuranStore();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const libraryVersions = Object.entries(versionDownloads)
    .filter(([, s]) => s?.status && s.status !== DownloadStatus.IDLE)
    .map(([v, s]) => ({ version: v as MushafVersion, state: s! }));

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(reduceMotion ? 150 : 200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      </Animated.View>

      <Animated.View
        entering={
          reduceMotion ? FadeIn.duration(150) : SlideInDown.springify().damping(20).stiffness(200)
        }
        exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          { backgroundColor: chrome.background, paddingBottom: insets.bottom + 8 },
        ]}>
        <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3">
          <Text fontSize={18} fontWeight="700">
            {t("quran.settings.title")}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}>
            <YStack
              width={32}
              height={32}
              borderRadius={16}
              backgroundColor={chrome.cardBorder}
              alignItems="center"
              justifyContent="center">
              <X color={chrome.subtleText} size={16} />
            </YStack>
          </Pressable>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$5">
            <Section title={t("quran.settings.display")} chrome={chrome}>
              <SettingRow label={t("quran.settings.readerMode")} chrome={chrome}>
                <Segmented
                  chrome={chrome}
                  options={[
                    { value: ReaderViewMode.MADINAH, label: t("quran.settings.modeMushaf") },
                    { value: ReaderViewMode.TEXT, label: t("quran.settings.modeText") },
                  ]}
                  selected={readerMode}
                  onSelect={setReaderMode}
                />
              </SettingRow>

              {readerMode === ReaderViewMode.TEXT && (
                <SettingRow label={t("quran.settings.fontSize")} chrome={chrome}>
                  <XStack
                    alignItems="center"
                    gap="$3"
                    backgroundColor={chrome.cardBorder}
                    borderRadius={10}
                    paddingHorizontal="$2"
                    paddingVertical="$1">
                    <Stepper
                      icon={Minus}
                      disabled={fontSize <= FONT_SIZE_MIN}
                      onPress={() => setFontSize(fontSize - FONT_SIZE_STEP)}
                      chrome={chrome}
                      label={t("a11y.decrease", { defaultValue: "Decrease" })}
                    />
                    <Text fontSize={14} fontWeight="600" minWidth={28} textAlign="center">
                      {fontSize}
                    </Text>
                    <Stepper
                      icon={Plus}
                      disabled={fontSize >= FONT_SIZE_MAX}
                      onPress={() => setFontSize(fontSize + FONT_SIZE_STEP)}
                      chrome={chrome}
                      label={t("a11y.increase", { defaultValue: "Increase" })}
                    />
                  </XStack>
                </SettingRow>
              )}
            </Section>

            <ReadingThemeSwatches />

            {readerMode === ReaderViewMode.MADINAH && (
              <YStack>
                <Pressable
                  onPress={() => setAdvancedOpen((o) => !o)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: advancedOpen }}>
                  <XStack alignItems="center" justifyContent="space-between" paddingVertical="$2">
                    <Text fontSize={13} fontWeight="700" color={chrome.subtleText}>
                      {t("quran.settings.advanced")}
                    </Text>
                    {advancedOpen ? (
                      <ChevronUp size={16} color={chrome.subtleText} />
                    ) : (
                      <ChevronDown size={16} color={chrome.subtleText} />
                    )}
                  </XStack>
                </Pressable>
                {advancedOpen && (
                  <SettingRow label={t("quran.settings.surahFrame")} chrome={chrome}>
                    <Segmented
                      chrome={chrome}
                      options={Object.values(SurahFrameStyle).map((style) => ({
                        value: style,
                        label: style.charAt(0).toUpperCase() + style.slice(1),
                      }))}
                      selected={surahFrameStyle}
                      onSelect={setSurahFrameStyle}
                      compact
                    />
                  </SettingRow>
                )}
              </YStack>
            )}

            <Section title={t("quran.settings.library")} chrome={chrome}>
              {libraryVersions.map(({ version, state }) => (
                <LibraryRow key={version} version={version} state={state} onClose={onClose} />
              ))}

              <Pressable
                onPress={onDownloadMore}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.downloadMore")}>
                <XStack alignItems="center" gap="$2" paddingVertical="$3" paddingHorizontal="$3">
                  <Download size={16} color={chrome.accent} />
                  <Text fontSize={15} color={chrome.accent} fontWeight="600">
                    {t("quran.settings.downloadMore")}
                  </Text>
                </XStack>
              </Pressable>
            </Section>

            <Section title={t("quran.settings.saved")} chrome={chrome}>
              <XStack
                alignItems="center"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$2"
                opacity={0.6}>
                <Bookmark size={16} color={chrome.subtleText} />
                <Text fontSize={14} color={chrome.subtleText}>
                  {t("quran.settings.savedSoon")}
                </Text>
              </XStack>
            </Section>
          </YStack>
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 11,
  },
});

export default QuranSettingsSheet;

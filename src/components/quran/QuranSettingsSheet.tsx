import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
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
import { Download, Minus, Plus, RotateCcw, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { MushafVersion, DownloadStatus, ReaderViewMode, ReaderPageFit } from "@/enums/quran";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";
import { QuranContentDB } from "@/services/quran-content-db";
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
    readerMode,
    fontSize,
    twoPageSpread,
    pageFit,
    setReaderMode,
    setFontSize,
    setTwoPageSpread,
    setPageFit,
  } = useQuranStore();

  const { width, height } = useWindowDimensions();
  const isLargeDevice = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;

  // Testing aid: wipe the installed quran.db and re-copy the bundled one. Lets a
  // TestFlight build pull changed bundled data without bumping QURAN_DB_VERSION.
  const [resetting, setResetting] = useState(false);
  const handleResetDb = () => {
    Alert.alert(
      "Reset Quran data?",
      "Deletes the installed Quran database and re-copies the bundled one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await QuranContentDB.forceResetQuranDb();
              Alert.alert("Quran data reset", "Reopen the reader to load the fresh data.");
            } catch (e) {
              Alert.alert("Reset failed", String(e));
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

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
        entering={reduceMotion ? FadeIn.duration(150) : SlideInDown.duration(240)}
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
            <ReadingThemeSwatches />

            <Section title={t("quran.settings.display")} chrome={chrome}>
              <SettingRow label={t("quran.settings.readerMode")} chrome={chrome} stacked>
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

              {isLargeDevice && (
                <SettingRow label={t("quran.settings.twoPageSpread")} chrome={chrome}>
                  <Switch
                    value={twoPageSpread}
                    onValueChange={setTwoPageSpread}
                    accessibilityLabel={t("quran.settings.twoPageSpread")}
                  />
                </SettingRow>
              )}

              {isLargeDevice && (
                <SettingRow label={t("quran.settings.pageFit")} chrome={chrome} stacked>
                  <Segmented
                    chrome={chrome}
                    options={[
                      { value: ReaderPageFit.FILL, label: t("quran.settings.pageFitFill") },
                      { value: ReaderPageFit.PAGE, label: t("quran.settings.pageFitPage") },
                    ]}
                    selected={pageFit}
                    onSelect={setPageFit}
                  />
                </SettingRow>
              )}
            </Section>

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

            {/* TODO(mutashabihat): remove this Maintenance section before the public
                App Store release — testing-only DB reset, visible in prod builds too. */}
            <Section title="Maintenance" chrome={chrome}>
              <Pressable
                onPress={handleResetDb}
                disabled={resetting}
                accessibilityRole="button"
                accessibilityLabel="Reset Quran database">
                <XStack alignItems="center" gap="$2" paddingVertical="$3" paddingHorizontal="$3">
                  <RotateCcw size={16} color={chrome.accentWarning} />
                  <Text fontSize={15} color={chrome.accentWarning} fontWeight="600">
                    {resetting ? "Resetting…" : "Reset Quran data (testing)"}
                  </Text>
                </XStack>
              </Pressable>
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

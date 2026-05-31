import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useQuranStore } from "@/stores/quran";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS, QURAN_UI_COLORS } from "@/constants/Quran";
import { MushafVersion, QuranTheme, DownloadStatus, ReaderViewMode } from "@/enums/quran";
import FontSizeControls from "@/components/quran/FontSizeControls";
import { QuranDownload } from "@/services/quran-download";
import QuranReader from "@/components/quran/QuranReader";
import PageSlider from "@/components/quran/PageSlider";
import QuranSettingsSheet from "@/components/quran/QuranSettingsSheet";
import VersionSelectionScreen from "@/components/quran/VersionSelectionScreen";
import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
import DownloadBanner from "@/components/quran/DownloadBanner";
import type { QuranManifestVersion } from "@/types/quran";

const ALL_THEMES = Object.values(QuranTheme);

const QuranScreen = () => {
  const {
    currentPage,
    currentVersion,
    quranThemeOverride,
    onboardingComplete,
    selectedVersion,
    versionDownloads,
    readerMode,
    fontSize,
    setCurrentPage,
    setQuranTheme,
    setQuranThemeAuto,
    setOnboardingComplete,
    setSelectedVersion,
    setReaderMode,
    setFontSize,
    updateDownloadState,
  } = useQuranStore();
  const quranTheme = useResolvedQuranTheme();
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [forceReader, setForceReader] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const selectedManifestRef = useRef<QuranManifestVersion | null>(null);

  const downloadState = selectedVersion ? versionDownloads[selectedVersion] : undefined;
  const downloadStatus = downloadState?.status ?? DownloadStatus.IDLE;

  const handleSelectVersion = useCallback(
    async (manifestVersion: QuranManifestVersion) => {
      const version = manifestVersion.id as MushafVersion;
      selectedManifestRef.current = manifestVersion;
      setSelectedVersion(version);
      setOnboardingComplete();

      const spaceCheck = QuranDownload.checkDiskSpace(manifestVersion.totalSizeMB);
      if (!spaceCheck.available) {
        Alert.alert(
          t("quran.download.noSpace", {
            required: manifestVersion.totalSizeMB,
            available: spaceCheck.availableMB,
          })
        );
        return;
      }

      updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });
      QuranDownload.start(version);
    },
    [setSelectedVersion, setOnboardingComplete, updateDownloadState, t]
  );

  const handleSelectTextMode = useCallback(() => {
    setReaderMode(ReaderViewMode.TEXT);
    setOnboardingComplete();
  }, [setReaderMode, setOnboardingComplete]);

  const handleStartReading = useCallback(() => {
    setForceReader(true);
  }, []);

  const handleDownloadMore = useCallback(() => {
    setShowSettings(false);
    setShowVersionPicker(true);
  }, []);

  // Route: onboarding → progress → reader
  if (!onboardingComplete) {
    return (
      <VersionSelectionScreen
        onSelectVersion={handleSelectVersion}
        onSelectTextMode={handleSelectTextMode}
      />
    );
  }

  // "Download more" version picker — download in background, don't switch
  if (showVersionPicker) {
    return (
      <VersionSelectionScreen
        onSelectVersion={(manifest) => {
          setShowVersionPicker(false);
          const version = manifest.id as MushafVersion;
          const spaceCheck = QuranDownload.checkDiskSpace(manifest.totalSizeMB);
          if (!spaceCheck.available) {
            Alert.alert(
              t("quran.download.noSpace", {
                required: manifest.totalSizeMB,
                available: spaceCheck.availableMB,
              })
            );
            return;
          }
          updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });
          QuranDownload.start(version);
        }}
        onSelectTextMode={() => setShowVersionPicker(false)}
      />
    );
  }

  const isActiveDownload = downloadStatus === DownloadStatus.DOWNLOADING;
  // A mushaf version is selected but its images aren't fully on disk.
  const needsMushaf =
    readerMode !== ReaderViewMode.TEXT && downloadStatus !== DownloadStatus.COMPLETE;

  if (selectedVersion && needsMushaf && !forceReader) {
    // An active download → live progress screen. Otherwise the version isn't
    // downloaded (interrupted, errored, or cleared on a previous launch) and
    // nothing is running → show the version picker so the user can choose or
    // re-download, instead of being trapped on a frozen progress screen.
    if (isActiveDownload) {
      return (
        <DownloadProgressScreen
          version={selectedVersion}
          versionName={t(`quran.version.${selectedVersion}`)}
          onStartReading={handleStartReading}
        />
      );
    }
    return (
      <VersionSelectionScreen
        onSelectVersion={handleSelectVersion}
        onSelectTextMode={handleSelectTextMode}
      />
    );
  }

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <StatusBar
        hidden={!showOverlay}
        animated
        style={quranTheme === QuranTheme.DARK ? "light" : "dark"}
      />
      <QuranReader
        currentPage={currentPage}
        version={currentVersion}
        quranTheme={quranTheme}
        readerMode={readerMode}
        fontSize={fontSize}
        onPageChange={setCurrentPage}
        onFontSizeChange={setFontSize}
        onTap={() => setShowOverlay((prev) => !prev)}
      />

      {/* Download banner — shows when a background download is active */}
      {!bannerDismissed && (
        <YStack position="absolute" top={insets.top + 8} left={0} right={0} zIndex={5}>
          <DownloadBanner quranTheme={quranTheme} onDismiss={() => setBannerDismissed(true)} />
        </YStack>
      )}

      {showOverlay && (
        <>
          {/* Top bar: settings (left) + close (right) */}
          <XStack
            position="absolute"
            top={insets.top + 8}
            left={16}
            right={16}
            justifyContent="space-between">
            <Pressable
              onPress={() => {
                setShowOverlay(false);
                setShowSettings(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("quran.settings.title")}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(0,0,0,0.3)",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <Settings color="white" size={18} />
            </Pressable>

            {readerMode === ReaderViewMode.TEXT && (
              <FontSizeControls fontSize={fontSize} onFontSizeChange={setFontSize} />
            )}

            <Pressable
              onPress={() => router.navigate("/")}
              accessibilityRole="button"
              accessibilityLabel="Close reader"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(0,0,0,0.3)",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <X color="white" size={18} />
            </Pressable>
          </XStack>

          {/* Page slider */}
          <YStack position="absolute" bottom={insets.bottom + 8} left={0} right={0}>
            <PageSlider
              currentPage={currentPage}
              quranTheme={quranTheme}
              onPageChange={setCurrentPage}
            />
          </YStack>

          {/* Theme picker */}
          <XStack
            position="absolute"
            bottom={insets.bottom + 60}
            alignSelf="center"
            gap="$1.5"
            backgroundColor="rgba(0,0,0,0.5)"
            borderRadius="$4"
            padding="$1.5">
            <Pressable
              onPress={() => setQuranThemeAuto()}
              accessibilityRole="button"
              accessibilityLabel="Match app theme"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: !quranThemeOverride ? 2.5 : 1,
                borderColor: !quranThemeOverride ? QURAN_UI_COLORS.accent : "rgba(255,255,255,0.3)",
              }}>
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: QURAN_THEME_COLORS[QuranTheme.SEPIA].background,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: QURAN_THEME_COLORS[QuranTheme.DARK].background,
                }}
              />
            </Pressable>
            {ALL_THEMES.map((key) => {
              const colors = QURAN_THEME_COLORS[key];
              const isSelected = quranThemeOverride && quranTheme === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setQuranTheme(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${key} theme`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.background,
                    borderWidth: isSelected ? 2.5 : 1,
                    borderColor: isSelected ? QURAN_UI_COLORS.accent : "rgba(255,255,255,0.3)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              );
            })}
          </XStack>
        </>
      )}

      {/* Settings bottom sheet */}
      {showSettings && (
        <QuranSettingsSheet
          quranTheme={quranTheme}
          onClose={() => setShowSettings(false)}
          onDownloadMore={handleDownloadMore}
        />
      )}
    </YStack>
  );
};

export default QuranScreen;

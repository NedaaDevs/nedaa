import { useCallback, useRef, useState } from "react";
import { Alert, Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Sun, Moon, BookOpen, Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useQuranStore } from "@/stores/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion, QuranTheme, DownloadStatus } from "@/enums/quran";
import { QuranDownload } from "@/services/quran-download";
import QuranReader from "@/components/quran/QuranReader";
import PageSlider from "@/components/quran/PageSlider";
import QuranSettingsSheet from "@/components/quran/QuranSettingsSheet";
import VersionSelectionScreen from "@/components/quran/VersionSelectionScreen";
import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
import DownloadBanner from "@/components/quran/DownloadBanner";
import type { QuranManifestVersion } from "@/types/quran";

const THEMES = [
  { key: QuranTheme.LIGHT, icon: Sun },
  { key: QuranTheme.SEPIA, icon: BookOpen },
  { key: QuranTheme.DARK, icon: Moon },
];

const QuranScreen = () => {
  const {
    currentPage,
    currentVersion,
    quranTheme,
    onboardingComplete,
    selectedVersion,
    versionDownloads,
    setCurrentPage,
    setQuranTheme,
    setOnboardingComplete,
    setSelectedVersion,
    updateDownloadState,
  } = useQuranStore();
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
    setOnboardingComplete();
  }, [setOnboardingComplete]);

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

  const isDownloading =
    downloadStatus === DownloadStatus.DOWNLOADING ||
    downloadStatus === DownloadStatus.PAUSED ||
    downloadStatus === DownloadStatus.ERROR;

  if (selectedVersion && isDownloading && !forceReader) {
    return (
      <DownloadProgressScreen
        version={selectedVersion}
        versionName={selectedManifestRef.current?.name ?? selectedVersion.toUpperCase()}
        onStartReading={handleStartReading}
      />
    );
  }

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <QuranReader
        currentPage={currentPage}
        version={currentVersion}
        quranTheme={quranTheme}
        onPageChange={setCurrentPage}
        onTap={() => setShowOverlay((prev) => !prev)}
      />

      {/* Download banner — shows when a background download is active */}
      {!bannerDismissed && (
        <YStack position="absolute" top={insets.top + 8} left={0} right={0} zIndex={5}>
          <DownloadBanner quranTheme={quranTheme} onDismiss={() => setBannerDismissed(true)} />
        </YStack>
      )}

      {/* Page slider — always visible at bottom, zIndex above reader */}
      <YStack position="absolute" bottom={insets.bottom + 8} left={0} right={0} zIndex={5}>
        <PageSlider
          currentPage={currentPage}
          quranTheme={quranTheme}
          onPageChange={setCurrentPage}
        />
      </YStack>

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

          {/* Theme picker */}
          <XStack
            position="absolute"
            bottom={insets.bottom + 60}
            alignSelf="center"
            gap="$1.5"
            backgroundColor="rgba(0,0,0,0.5)"
            borderRadius="$4"
            padding="$1.5">
            {THEMES.map(({ key, icon: Icon }) => (
              <Pressable
                key={key}
                onPress={() => setQuranTheme(key)}
                accessibilityRole="button"
                accessibilityLabel={`${key} theme`}>
                <XStack
                  padding="$2"
                  borderRadius="$3"
                  backgroundColor={quranTheme === key ? "$primary" : "transparent"}>
                  <Icon color={quranTheme === key ? "white" : "#ccc"} size={16} />
                </XStack>
              </Pressable>
            ))}
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

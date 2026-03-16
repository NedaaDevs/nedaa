import { useCallback, useRef, useState } from "react";
import { Alert, Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Sun, Moon, BookOpen } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion, QuranTheme, DownloadStatus } from "@/enums/quran";
import { QuranDownload } from "@/services/quran-download";
import QuranReader from "@/components/quran/QuranReader";
import VersionSelectionScreen from "@/components/quran/VersionSelectionScreen";
import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
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
    setCurrentVersion,
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
  const [forceReader, setForceReader] = useState(false);
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

  // Route: onboarding → progress → reader
  if (!onboardingComplete) {
    return (
      <VersionSelectionScreen
        onSelectVersion={handleSelectVersion}
        onSelectTextMode={handleSelectTextMode}
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

  // Version toggle: only show downloaded versions
  const downloadedVersions = Object.entries(versionDownloads)
    .filter(([, state]) => state?.status === DownloadStatus.COMPLETE)
    .map(([v]) => v as MushafVersion);

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <QuranReader
        currentPage={currentPage}
        version={currentVersion}
        quranTheme={quranTheme}
        onPageChange={setCurrentPage}
        onTap={() => setShowOverlay((prev) => !prev)}
      />

      {showOverlay && (
        <>
          <Pressable
            onPress={() => router.navigate("/")}
            accessibilityRole="button"
            accessibilityLabel="Close reader"
            style={{
              position: "absolute",
              top: insets.top + 8,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(0,0,0,0.3)",
              alignItems: "center",
              justifyContent: "center",
            }}>
            <X color="white" size={18} />
          </Pressable>

          <XStack
            position="absolute"
            bottom={insets.bottom + 44}
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

          {downloadedVersions.length > 0 && (
            <XStack
              position="absolute"
              bottom={insets.bottom + 4}
              alignSelf="center"
              gap="$2"
              backgroundColor="rgba(0,0,0,0.5)"
              borderRadius="$4"
              padding="$2">
              {downloadedVersions.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setCurrentVersion(v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${v}`}>
                  <XStack
                    paddingHorizontal="$3"
                    paddingVertical="$1.5"
                    borderRadius="$3"
                    backgroundColor={currentVersion === v ? "$primary" : "transparent"}>
                    <Text
                      size="sm"
                      fontWeight={currentVersion === v ? "700" : "400"}
                      color={currentVersion === v ? "white" : "#ccc"}>
                      {v.toUpperCase()}
                    </Text>
                  </XStack>
                </Pressable>
              ))}
            </XStack>
          )}
        </>
      )}
    </YStack>
  );
};

export default QuranScreen;

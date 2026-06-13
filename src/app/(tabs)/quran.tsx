import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  List,
  Bookmark,
  ArrowRightToLine,
  ArrowLeftToLine,
  Settings2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { useResolvedQuranTheme, usePrefersDarkReader } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS, isColoredVersion } from "@/constants/Quran";
import { MushafVersion, QuranTheme, DownloadStatus, ReaderViewMode } from "@/enums/quran";
import { QuranDownload } from "@/services/quran-download";
import QuranReader from "@/components/quran/QuranReader";
import QuranDbGate from "@/components/quran/QuranDbGate";
import PageSlider from "@/components/quran/PageSlider";
import QuranSettingsSheet from "@/components/quran/QuranSettingsSheet";
import VersionSelectionScreen from "@/components/quran/VersionSelectionScreen";
import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
import DownloadBanner from "@/components/quran/DownloadBanner";
import DarkOfferBanner from "@/components/quran/DarkOfferBanner";
import FontSizeControls from "@/components/quran/FontSizeControls";
import HighlightLegend from "@/components/quran/HighlightLegend";
import SurahInfoCard from "@/components/quran/SurahInfoCard";
import ReaderIcon from "@/components/quran/ReaderIcon";
import AyahActionSheet from "@/components/quran/sheets/AyahActionSheet";
import { useQuranContentDbReady } from "@/hooks/useQuranContentDbReady";
import type { QuranManifestVersion } from "@/types/quran";

const QuranScreen = () => {
  const {
    currentPage,
    currentVersion,
    onboardingComplete,
    selectedVersion,
    versionDownloads,
    darkOfferDismissed,
    readerMode,
    fontSize,
    setCurrentPage,
    setOnboardingComplete,
    setSelectedVersion,
    setReaderMode,
    setFontSize,
    setReaderActive,
    updateDownloadState,
    dismissDarkOffer,
  } = useQuranStore();
  const quranTheme = useResolvedQuranTheme();
  const prefersDark = usePrefersDarkReader();
  const { state: dbState, retry: retryDb } = useQuranContentDbReady();
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useRTL();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [actionAyah, setActionAyah] = useState<{ surah: number; ayah: number } | null>(null);
  const [infoSurah, setInfoSurah] = useState<number | null>(null);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // The version whose download the user is actively watching on the progress
  // screen this session. Keeps that screen up through completion (so they can
  // tap "Start reading") and distinguishes it from an already-installed version
  // entered on launch. Not persisted — a killed/relaunched app shows the picker.
  const [downloadFlowVersion, setDownloadFlowVersion] = useState<MushafVersion | null>(null);
  const selectedManifestRef = useRef<QuranManifestVersion | null>(null);

  const downloadState = selectedVersion ? versionDownloads[selectedVersion] : undefined;
  const downloadStatus = downloadState?.status ?? DownloadStatus.IDLE;

  // A mushaf version is selected but its images aren't fully on disk.
  const needsMushaf =
    readerMode !== ReaderViewMode.TEXT && downloadStatus !== DownloadStatus.COMPLETE;
  // The user is watching this version's download on the progress screen.
  const inDownloadFlow = !!selectedVersion && downloadFlowVersion === selectedVersion;
  // The immersive reader is the visible surface only when no chrome screen wins
  // (mirrors the render branches below). Drives the status-bar safe-area theme.
  const showReader =
    onboardingComplete &&
    !showVersionPicker &&
    !inDownloadFlow &&
    !(selectedVersion && needsMushaf);

  useEffect(() => {
    setReaderActive(showReader);
  }, [showReader, setReaderActive]);

  const handleSelectVersion = useCallback(
    async (manifestVersion: QuranManifestVersion) => {
      const version = manifestVersion.id as MushafVersion;
      selectedManifestRef.current = manifestVersion;
      setSelectedVersion(version);
      setOnboardingComplete();

      // Already installed → switch and read, no download or progress screen.
      if (versionDownloads[version]?.status === DownloadStatus.COMPLETE) {
        setDownloadFlowVersion(null);
        return;
      }

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

      // Switch to the new edition and show its download progress screen; it
      // opens in the reader when the user taps Start reading.
      updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });
      setDownloadFlowVersion(version);
      QuranDownload.start(version);
    },
    [versionDownloads, setSelectedVersion, setOnboardingComplete, updateDownloadState, t]
  );

  const handleSelectTextMode = useCallback(() => {
    setReaderMode(ReaderViewMode.TEXT);
    setOnboardingComplete();
  }, [setReaderMode, setOnboardingComplete]);

  // Leaving the progress screen for the reader: clear the flow so routing falls
  // through to the reader (the version is already COMPLETE at this point).
  const handleStartReading = useCallback(() => {
    setDownloadFlowVersion(null);
  }, []);

  // Cancel mid-download: abort the transfer and drop the flow, returning to the
  // picker so the user can choose again or re-download.
  const handleCancelDownload = useCallback(() => {
    if (selectedVersion) QuranDownload.cancel(selectedVersion);
    setDownloadFlowVersion(null);
  }, [selectedVersion]);

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

  // "Download more" version picker — selecting an edition switches to it and
  // shows its download progress screen (or opens it if already installed).
  if (showVersionPicker) {
    return (
      <VersionSelectionScreen
        onSelectVersion={(manifest) => {
          setShowVersionPicker(false);
          handleSelectVersion(manifest);
        }}
        onSelectTextMode={() => setShowVersionPicker(false)}
      />
    );
  }

  // Active download → live progress screen. Shown for any in-progress download
  // of the selected edition (so it survives a remount that drops the ephemeral
  // flow flag), and kept up through completion via the flow so the user can tap
  // "Start reading".
  if (
    selectedVersion &&
    (inDownloadFlow ||
      downloadStatus === DownloadStatus.DOWNLOADING ||
      downloadStatus === DownloadStatus.PAUSED)
  ) {
    return (
      <DownloadProgressScreen
        version={selectedVersion}
        versionName={t(`quran.version.${selectedVersion}`)}
        onStartReading={handleStartReading}
        onCancel={handleCancelDownload}
      />
    );
  }

  // Selected version isn't on disk and no download is running (interrupted,
  // errored, or cleared on a previous launch) → picker, so the user can choose
  // or re-download instead of being trapped on a frozen progress screen.
  if (selectedVersion && needsMushaf) {
    return (
      <VersionSelectionScreen
        onSelectVersion={handleSelectVersion}
        onSelectTextMode={handleSelectTextMode}
      />
    );
  }

  // The reader reads from the bundled quran.db (ayah text + surah metadata), so
  // hold it behind the copy/open gate: a loader while that completes, a retry if
  // it fails — instead of rendering an empty page on a not-yet-ready DB.
  if (dbState !== "ready") {
    return <QuranDbGate state={dbState} quranTheme={quranTheme} onRetry={retryDb} />;
  }

  // Offer the dark page bundle only while reading a colored edition in dark
  // mode without it — and only until downloaded or dismissed (persisted).
  const darkStatus = versionDownloads[currentVersion]?.dark?.status;
  const showDarkOffer =
    isColoredVersion(currentVersion) &&
    prefersDark &&
    darkStatus !== DownloadStatus.COMPLETE &&
    darkStatus !== DownloadStatus.DOWNLOADING &&
    !darkOfferDismissed[currentVersion];

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
        onAyahLongPress={(surah, ayah) => {
          // The ayah sheet is the focus — clear the reader chrome behind it.
          setShowOverlay(false);
          setActionAyah({ surah, ayah });
        }}
        onSurahLongPress={(surah) => {
          setShowOverlay(false);
          setInfoSurah(surah);
        }}
        selectedAyah={actionAyah}
      />

      {/* Top banners: an active background download, and/or the one-time dark
          page offer for a colored edition. */}
      {(!bannerDismissed || showDarkOffer) && (
        <YStack position="absolute" top={insets.top + 8} left={0} right={0} zIndex={5} gap="$2">
          {!bannerDismissed && <DownloadBanner onDismiss={() => setBannerDismissed(true)} />}
          {showDarkOffer && (
            <DarkOfferBanner
              version={currentVersion}
              onDismiss={() => dismissDarkOffer(currentVersion)}
            />
          )}
        </YStack>
      )}

      {showOverlay && (
        <>
          {/* Top chrome bar — icon row plus the highlight legend, both on the bar
              so the chips sit on the chrome rather than over the page. */}
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            zIndex={15}
            gap="$2"
            paddingTop={insets.top + 6}
            paddingBottom="$2.5"
            paddingHorizontal="$3"
            backgroundColor={`${themeColors.background}F0`}
            borderBottomWidth={1}
            borderBottomColor={themeColors.frameColor}>
            <XStack alignItems="center" gap="$2">
              <Pressable
                onPress={() => router.navigate("/")}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <ReaderIcon
                  sf={isRTL ? "chevron.right" : "chevron.left"}
                  lucide={BackIcon}
                  color={themeColors.headerColor}
                  size={22}
                />
              </Pressable>
              <YStack flex={1} />
              {readerMode === ReaderViewMode.TEXT && (
                <FontSizeControls
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  color={themeColors.headerColor}
                />
              )}
              <Pressable
                onPress={() => {
                  setShowOverlay(false);
                  router.push("/quran-library?tab=bookmarks");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.library.bookmarks")}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <ReaderIcon
                  sf="bookmark"
                  lucide={Bookmark}
                  color={themeColors.headerColor}
                  size={20}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowOverlay(false);
                  setShowSettings(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.title")}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <ReaderIcon
                  sf="gearshape"
                  lucide={Settings2}
                  color={themeColors.headerColor}
                  size={20}
                />
              </Pressable>
            </XStack>

            {/* Highlight legend — colours/labels/counts; renders only when ayahs
                are highlighted. Tap a chip to open the highlights list. */}
            <HighlightLegend
              quranTheme={quranTheme}
              onPress={() => {
                setShowOverlay(false);
                router.push("/quran-highlights");
              }}
            />
          </YStack>

          {/* Bottom chrome bar — Surahs · scrubber · Go-to. */}
          <YStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            zIndex={15}
            gap="$2"
            paddingTop="$3"
            paddingBottom={insets.bottom + 12}
            paddingHorizontal="$3"
            backgroundColor={`${themeColors.background}F0`}
            borderTopWidth={1}
            borderTopColor={themeColors.frameColor}>
            <XStack alignItems="center" justifyContent="space-between">
              <Pressable
                onPress={() => {
                  setShowOverlay(false);
                  router.push("/quran-library");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.library.title")}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <ReaderIcon
                  sf="list.bullet"
                  lucide={List}
                  color={themeColors.headerColor}
                  size={22}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowOverlay(false);
                  router.push("/quran-browse?tab=page");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.goto.title")}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <ReaderIcon
                  sf={isRTL ? "arrow.left.to.line" : "arrow.right.to.line"}
                  lucide={isRTL ? ArrowLeftToLine : ArrowRightToLine}
                  color={themeColors.headerColor}
                  size={22}
                />
              </Pressable>
            </XStack>
            <PageSlider
              currentPage={currentPage}
              quranTheme={quranTheme}
              onPageChange={setCurrentPage}
            />
          </YStack>
        </>
      )}

      {/* Settings bottom sheet */}
      {showSettings && (
        <QuranSettingsSheet
          onClose={() => setShowSettings(false)}
          onDownloadMore={handleDownloadMore}
        />
      )}

      {/* Long-press ayah action sheet */}
      <AyahActionSheet
        target={actionAyah}
        quranTheme={quranTheme}
        onClose={() => setActionAyah(null)}
      />

      {/* Long-press surah header → surah info sheet (controlled; stays mounted) */}
      <SurahInfoCard
        surahNumber={infoSurah}
        quranTheme={quranTheme}
        onClose={() => setInfoSurah(null)}
      />
    </YStack>
  );
};

export default QuranScreen;

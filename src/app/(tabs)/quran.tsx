import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  List,
  Bookmark,
  Search,
  Settings2,
  Palette,
  HelpCircle,
  AudioLines,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { QuranContentDB } from "@/services/quran-content-db";
import { localizedSurahName } from "@/utils/surahName";
import { useRTL } from "@/contexts/RTLContext";
import { useResolvedQuranTheme, usePrefersDarkReader } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS, isColoredVersion, isDarkPaper } from "@/constants/Quran";
import { MushafVersion, DownloadStatus, ReaderViewMode, ScrollDirection } from "@/enums/quran";
import { PlatformType } from "@/enums/app";
import { QuranDownload } from "@/services/quran-download";
import QuranReader from "@/components/quran/QuranReader";
import QuranDbGate from "@/components/quran/QuranDbGate";
import PageSlider from "@/components/quran/PageSlider";
import AutoScrollControl from "@/components/quran/AutoScrollControl";
import QuranSettingsSheet from "@/components/quran/QuranSettingsSheet";
import VersionSelectionScreen from "@/components/quran/VersionSelectionScreen";
import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
import DownloadBanner from "@/components/quran/DownloadBanner";
import DarkOfferBanner from "@/components/quran/DarkOfferBanner";
import FontSizeControls from "@/components/quran/FontSizeControls";
import HighlightLegend from "@/components/quran/HighlightLegend";
import SurahInfoCard from "@/components/quran/SurahInfoCard";
import QuranSearchOverlay, { type QuranSearchHandle } from "@/components/quran/QuranSearchOverlay";
import ReaderLibraryDrawer, {
  type ReaderLibraryDrawerHandle,
} from "@/components/quran/ReaderLibraryDrawer";
import ReaderIcon from "@/components/quran/ReaderIcon";
import AyahActionSheet from "@/components/quran/sheets/AyahActionSheet";
import QuranIntroSheet from "@/components/quran/sheets/QuranIntroSheet";
import GuideSheet from "@/components/quran/sheets/GuideSheet";
import { useQuranContentDbReady } from "@/hooks/useQuranContentDbReady";
import { GuideCategory, type GuideEntry } from "@/types/guide";
import { guideEntriesByCategory, guideEntryById } from "@/services/guide-content";
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
    scrollDirection,
    jumpReturn,
    setJumpReturn,
    setFlashAyah,
    setCurrentPage,
    setOnboardingComplete,
    setSelectedVersion,
    setReaderMode,
    setFontSize,
    setReaderActive,
    updateDownloadState,
    dismissDarkOffer,
    hasSeenQuranGuide,
    setQuranGuideSeen,
  } = useQuranStore();
  const quranPlayerState = useQuranAudioStore((s) => s.playerState);
  const playingSurah = useQuranAudioStore((s) => s.currentSurah);
  const playingAyah = useQuranAudioStore((s) => s.currentAyah);
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
  const [showIntro, setShowIntro] = useState(false);
  const [actionAyah, setActionAyah] = useState<{ surah: number; ayah: number } | null>(null);
  const [infoSurah, setInfoSurah] = useState<number | null>(null);
  const [guideSheet, setGuideSheet] = useState<{ entries: GuideEntry[]; titleKey: string } | null>(
    null
  );
  const openGuide = (category: GuideCategory) => {
    setShowOverlay(false);
    setGuideSheet({
      entries: guideEntriesByCategory(category),
      titleKey: `quran.guide.category.${category}`,
    });
  };
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // The version whose download the user is actively watching on the progress
  // screen this session. Keeps that screen up through completion (so they can
  // tap "Start reading") and distinguishes it from an already-installed version
  // entered on launch. Not persisted — a killed/relaunched app shows the picker.
  const [downloadFlowVersion, setDownloadFlowVersion] = useState<MushafVersion | null>(null);
  const selectedManifestRef = useRef<QuranManifestVersion | null>(null);
  const searchRef = useRef<QuranSearchHandle>(null);
  const libraryRef = useRef<ReaderLibraryDrawerHandle>(null);

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
    // Leaving the reader drops any pending "return to" target so a stale pill
    // never lingers when the user comes back later.
    if (!showReader) setJumpReturn(null);
  }, [showReader, setReaderActive, setJumpReturn]);

  // The "return" pill auto-dismisses a few seconds after a jump, so it doesn't
  // linger once you've settled on the new verse; tap it before then to go back.
  useEffect(() => {
    if (jumpReturn === null) return;
    const id = setTimeout(() => setJumpReturn(null), 6000);
    return () => clearTimeout(id);
  }, [jumpReturn, setJumpReturn]);

  // Mutashabihat "go to": close the action sheet and jump the reader to the picked verse.
  const subGoTo = useCallback(
    (surah: number, ayah: number, page: number) => {
      setActionAyah(null);
      setJumpReturn(currentPage);
      setCurrentPage(page);
      setFlashAyah({ surah, ayah });
    },
    [currentPage, setJumpReturn, setCurrentPage, setFlashAyah]
  );

  // Jump the reader to the verse the player is currently reciting.
  const goToPlaying = useCallback(() => {
    if (playingSurah == null) return;
    const ayah = playingAyah ?? 1;
    QuranContentDB.getAyahMetadata(playingSurah, ayah)
      .then((meta) => {
        if (!meta) return;
        setJumpReturn(currentPage);
        setCurrentPage(meta.page);
        setFlashAyah({ surah: playingSurah, ayah });
      })
      .catch(() => {});
  }, [playingSurah, playingAyah, currentPage, setJumpReturn, setCurrentPage, setFlashAyah]);

  // Ensure the edition's ayah-marker frames are installed (covers editions added
  // before the ornament pack shipped). Idempotent + tiny (~20KB); no-ops once on
  // disk. New downloads already include markers via the edition download.
  useEffect(() => {
    if (showReader) QuranDownload.ensureMarkersInstalled(currentVersion);
  }, [showReader, currentVersion]);

  // First time the reader is shown, run the gesture walkthrough.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showReader && !hasSeenQuranGuide) setShowIntro(true);
  }, [showReader, hasSeenQuranGuide]);

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

      const sizeMB = Math.round(
        (manifestVersion.images.light.bytes + manifestVersion.meta.bytes) / 1e6
      );
      const spaceCheck = QuranDownload.checkDiskSpace(sizeMB);
      if (!spaceCheck.available) {
        Alert.alert(
          t("quran.download.noSpace", {
            required: sizeMB,
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

  // Full reset: wipe everything, re-arm the content gate, drop the settings sheet.
  // The emptied store re-routes to the version picker (onboardingComplete false).
  const handleResetAll = useCallback(async () => {
    await QuranDownload.resetAll();
    retryDb();
    setShowSettings(false);
  }, [retryDb]);

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
        onBack={() => {
          setShowVersionPicker(false);
          setShowSettings(true);
        }}
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
      {/* Wraps the reader so the pull-down search gesture is a parent of (and
          arbitrated with) the reader's tap + page long-press. */}
      <ReaderLibraryDrawer ref={libraryRef}>
        <QuranSearchOverlay ref={searchRef}>
          <StatusBar
            hidden={!showOverlay}
            animated
            style={isDarkPaper(quranTheme) ? "light" : "dark"}
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
            onWaqfPress={(signId) => {
              const entry = guideEntryById(signId);
              if (entry) setGuideSheet({ entries: [entry], titleKey: "quran.guide.category.waqf" });
            }}
            selectedAyah={actionAyah}
          />

          {/* Auto-scroll control — vertical mode only, suppressed while a sheet has
          focus. Pinned above the bottom chrome bar (≈120pt) so it never overlaps.
          `box-none` lets taps through when it's faded out so the reader gets them. */}
          {scrollDirection === ScrollDirection.VERTICAL &&
            !actionAyah &&
            infoSurah == null &&
            !guideSheet && (
              <YStack
                position="absolute"
                bottom={insets.bottom + 136}
                left={0}
                right={0}
                alignItems="center"
                zIndex={12}
                pointerEvents="box-none">
                <AutoScrollControl quranTheme={quranTheme} visible={showOverlay} />
              </YStack>
            )}

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
                // iOS keeps the SafeAreaView top edge (it already applies insets.top),
                // so only Android — which drops that edge for the immersive reader —
                // adds the inset here. Avoids a double top inset on iOS.
                paddingTop={(Platform.OS === PlatformType.ANDROID ? insets.top : 0) + 6}
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
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <ReaderIcon
                      sf={isRTL ? "chevron.right" : "chevron.left"}
                      lucide={BackIcon}
                      color={themeColors.headerColor}
                      size={22}
                    />
                  </Pressable>
                  {quranPlayerState !== QURAN_PLAYER_STATE.IDLE && playingSurah != null ? (
                    <Pressable
                      onPress={goToPlaying}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.quran.listen.goToPlaying")}
                      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <XStack alignItems="center" gap="$1.5" maxWidth="80%">
                        <AudioLines size={13} color={themeColors.headerColor} />
                        <Text
                          fontSize={13}
                          fontWeight="700"
                          color={themeColors.headerColor}
                          numberOfLines={1}>
                          {localizedSurahName(playingSurah)}
                        </Text>
                      </XStack>
                    </Pressable>
                  ) : (
                    <YStack flex={1} />
                  )}
                  {readerMode === ReaderViewMode.TEXT && (
                    <FontSizeControls
                      fontSize={fontSize}
                      onFontSizeChange={setFontSize}
                      color={themeColors.headerColor}
                    />
                  )}
                  {isColoredVersion(currentVersion) && readerMode !== ReaderViewMode.TEXT && (
                    <Pressable
                      onPress={() => openGuide(GuideCategory.TAJWEED)}
                      accessibilityRole="button"
                      accessibilityLabel={t("quran.guide.category.tajweed")}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      <ReaderIcon
                        sf="paintpalette"
                        lucide={Palette}
                        color={themeColors.headerColor}
                        size={20}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setShowOverlay(false);
                      searchRef.current?.open();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.search.placeholder")}
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <ReaderIcon
                      sf="magnifyingglass"
                      lucide={Search}
                      color={themeColors.headerColor}
                      size={20}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowOverlay(false);
                      libraryRef.current?.open("bookmarks");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.library.bookmarks")}
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
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
                      setShowIntro(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.intro.help")}
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <ReaderIcon
                      sf="questionmark.circle"
                      lucide={HelpCircle}
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
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
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
                      libraryRef.current?.open("index");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.library.title")}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                    <ReaderIcon
                      sf="list.bullet"
                      lucide={List}
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
              onResetAll={handleResetAll}
            />
          )}

          {/* Return-to pill after a mutashabihat "go to" jump */}
          {jumpReturn !== null && (
            <Pressable
              onPress={() => {
                setCurrentPage(jumpReturn);
                setJumpReturn(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("quran.mutashabihat.return")}
              style={{
                position: "absolute",
                alignSelf: "center",
                bottom: insets.bottom + 24,
                zIndex: 16,
              }}>
              <XStack
                alignItems="center"
                gap="$2"
                paddingVertical="$2"
                paddingHorizontal="$3.5"
                borderRadius={22}
                borderWidth={1}
                borderColor={themeColors.frameColor}
                style={{ backgroundColor: `${themeColors.background}F5` }}>
                <BackIcon size={16} color={themeColors.headerColor} />
                <Text fontSize={13} fontWeight="700" color={themeColors.headerColor}>
                  {t("quran.mutashabihat.return")}
                </Text>
              </XStack>
            </Pressable>
          )}

          {/* First-open (and replayable) reader walkthrough */}
          {showIntro && (
            <QuranIntroSheet
              quranTheme={quranTheme}
              onClose={() => {
                setShowIntro(false);
                setQuranGuideSeen();
              }}
            />
          )}

          {/* Long-press ayah action sheet. Sub-views (similar verses, tajweed, sajda)
            swap into its body — one sheet, so closing a sub-view returns to the actions. */}
          <AyahActionSheet
            target={actionAyah}
            quranTheme={quranTheme}
            onClose={() => setActionAyah(null)}
            onGoTo={subGoTo}
          />

          {/* Long-press surah header → surah info sheet (controlled; stays mounted) */}
          <SurahInfoCard
            surahNumber={infoSurah}
            quranTheme={quranTheme}
            onClose={() => setInfoSurah(null)}
          />

          {/* Contextual reference sheet (tajweed legend, waqf sign, sajda + dua) */}
          {guideSheet && (
            <GuideSheet
              entries={guideSheet.entries}
              titleKey={guideSheet.titleKey}
              quranTheme={quranTheme}
              onClose={() => setGuideSheet(null)}
            />
          )}
        </QuranSearchOverlay>
      </ReaderLibraryDrawer>
    </YStack>
  );
};

export default QuranScreen;

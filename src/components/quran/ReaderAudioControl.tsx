import { useCallback, useEffect, useState } from "react";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { MotiView } from "moti";
import {
  Play,
  Pause,
  X,
  Highlighter,
  ChevronDown,
  Download,
  CheckCircle2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";
import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioDownload } from "@/services/quran-audio/quranAudioDownload";
import { QuranManifestService } from "@/services/quran-manifest";
import { QuranContentDB } from "@/services/quran-content-db";
import { usePreferencesStore } from "@/stores/preferences";
import { ReaderReciterSheet } from "@/components/quran/ReaderReciterSheet";

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 8,
  elevation: 5,
} as const;

// Floating reader audio control for the current recitation — its own control (not
// the Listen mini-player), pinned where the auto-scroll control sits and following
// the reader chrome (`visible`). Default: a slim one-row pill (tap reciter to switch,
// word follow-along toggle, play/pause, stop). The "Larger controls" preference swaps
// in a big two-row card with the reciter centred on top.
const ReaderAudioControl = ({
  quranTheme,
  visible,
}: {
  quranTheme: QuranThemeType;
  visible: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const colors = QURAN_THEME_COLORS[quranTheme];
  const big = usePreferencesStore((s) => s.largeControls);

  const readAlong = useQuranStore((s) => s.readAlong);
  const toggleReadAlong = useQuranStore((s) => s.toggleReadAlong);
  const currentPage = useQuranStore((s) => s.currentPage);
  const version = useQuranStore((s) => s.currentVersion);
  const playerState = useQuranAudioStore((s) => s.playerState);
  const queueKind = useQuranAudioStore((s) => s.queue?.kind);
  const readerRecitationId = useQuranAudioStore((s) => s.readerRecitationId);

  const [reciterName, setReciterName] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    quranReciterRegistry.reciterOf(readerRecitationId).then((r) => {
      if (alive && r) setReciterName(quranReciterRegistry.localizedName(r, i18n.language));
    });
    return () => {
      alive = false;
    };
  }, [readerRecitationId, i18n.language]);

  // Offline the current page's surah (per-ayah files). Streaming per-ayah is
  // unreliable, so the reader lets you pull a surah's bundle for local playback.
  const [dl, setDl] = useState<"idle" | "busy" | "done">("idle");

  const resolveTarget = useCallback(async () => {
    const glyphs = await QuranContentDB.getGlyphBounds(version, currentPage);
    const first = glyphs.find((g) => !g.isMarker);
    if (!first) return null;
    const [recitation, surahMeta, manifest] = await Promise.all([
      quranReciterRegistry.getRecitationById(readerRecitationId),
      QuranContentDB.getSurah(first.surahNumber),
      QuranManifestService.fetchManifest(),
    ]);
    if (!recitation || !surahMeta || !manifest) return null;
    return {
      recitation,
      surah: first.surahNumber,
      ayahCount: surahMeta.ayahCount,
      baseUrl: manifest.baseUrl,
    };
  }, [version, currentPage, readerRecitationId]);

  // Reflect whether the current page's surah is already saved.
  useEffect(() => {
    let alive = true;
    resolveTarget().then(async (tgt) => {
      if (!alive) return;
      if (!tgt) {
        setDl("idle");
        return;
      }
      const has = await quranAudioDownload.hasSurah(
        tgt.recitation.id,
        tgt.surah,
        tgt.ayahCount,
        tgt.recitation.fileFormat
      );
      if (alive) setDl(has ? "done" : "idle");
    });
    return () => {
      alive = false;
    };
  }, [resolveTarget]);

  const onDownload = async () => {
    if (dl !== "idle") return;
    const tgt = await resolveTarget();
    if (!tgt) return;
    setDl("busy");
    await quranAudioDownload.downloadSurah(tgt.recitation, tgt.surah, tgt.ayahCount, tgt.baseUrl);
    const has = await quranAudioDownload.hasSurah(
      tgt.recitation.id,
      tgt.surah,
      tgt.ayahCount,
      tgt.recitation.fileFormat
    );
    setDl(has ? "done" : "idle");
  };

  // Only reflect the reader's own (ayah) playback — a Listen (surah) session sharing
  // the player must not surface in the reader control.
  const isReaderPlayback = queueKind != null && queueKind !== QURAN_QUEUE_KIND.SURAH;
  const loading = isReaderPlayback && playerState === QURAN_PLAYER_STATE.LOADING;
  const playing = isReaderPlayback && playerState === QURAN_PLAYER_STATE.PLAYING;
  const active = isReaderPlayback && playerState !== QURAN_PLAYER_STATE.IDLE;

  const onPlayPause = async () => {
    if (playing) {
      void quranAudioPlayer.pause();
      return;
    }
    if (isReaderPlayback && playerState === QURAN_PLAYER_STATE.PAUSED) {
      void quranAudioPlayer.resume();
      return;
    }
    // Idle → start from the first ayah on the current page (the ayah action sheet
    // is the way to start from a specific ayah).
    const glyphs = await QuranContentDB.getGlyphBounds(version, currentPage);
    const first = glyphs.find((g) => !g.isMarker);
    if (first) void quranAudioPlayer.playFromHere(first.surahNumber, first.ayahNumber);
  };

  const reciterButton = (fontSize: number, chevron: number) => (
    <Pressable
      onPress={() => setSheetOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={t("quran.reader.chooseReciter")}
      hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center", gap: 3, minHeight: 30 }}>
      <Text
        fontSize={fontSize}
        fontWeight="700"
        color={colors.headerColor}
        numberOfLines={1}
        maxWidth={big ? 230 : 150}>
        {reciterName ?? t("quran.reader.reciter")}
      </Text>
      <ChevronDown size={chevron} color={colors.headerColor} opacity={0.8} />
    </Pressable>
  );

  const followToggle = (touch: number, dot: number, icon: number) => (
    <Pressable
      onPress={toggleReadAlong}
      accessibilityRole="switch"
      accessibilityState={{ checked: readAlong }}
      accessibilityLabel={t("a11y.quran.readAlong")}
      hitSlop={6}
      style={{ width: touch, height: touch, alignItems: "center", justifyContent: "center" }}>
      <YStack
        width={dot}
        height={dot}
        borderRadius={dot / 2}
        alignItems="center"
        justifyContent="center"
        backgroundColor={readAlong ? colors.headerColor : "transparent"}>
        <Highlighter
          size={icon}
          color={readAlong ? colors.background : colors.headerColor}
          opacity={readAlong ? 1 : 0.6}
        />
      </YStack>
    </Pressable>
  );

  const playButton = (size: number, icon: number) => (
    <Pressable
      onPress={onPlayPause}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t(playing ? "a11y.quran.listen.pause" : "a11y.quran.listen.play")}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.headerColor,
      }}>
      {loading ? (
        <Spinner size="small" color={colors.background} />
      ) : playing ? (
        <Pause size={icon} color={colors.background} fill={colors.background} />
      ) : (
        <Play size={icon} color={colors.background} fill={colors.background} />
      )}
    </Pressable>
  );

  const downloadButton = (touch: number, icon: number) => (
    <Pressable
      onPress={onDownload}
      disabled={dl !== "idle"}
      accessibilityRole="button"
      accessibilityLabel={t("quran.reader.downloadSurah")}
      hitSlop={6}
      style={{ width: touch, height: touch, alignItems: "center", justifyContent: "center" }}>
      {dl === "busy" ? (
        <Spinner size="small" color={colors.headerColor} />
      ) : dl === "done" ? (
        <CheckCircle2 size={icon} color={colors.headerColor} opacity={0.7} />
      ) : (
        <Download size={icon} color={colors.headerColor} opacity={0.7} />
      )}
    </Pressable>
  );

  const stopButton = (touch: number, icon: number) =>
    active ? (
      <Pressable
        onPress={() => void quranAudioPlayer.stop()}
        accessibilityRole="button"
        accessibilityLabel={t("common.stop")}
        hitSlop={6}
        style={{ width: touch, height: touch, alignItems: "center", justifyContent: "center" }}>
        <X size={icon} color={colors.headerColor} opacity={0.7} />
      </Pressable>
    ) : (
      <YStack width={touch} height={touch} />
    );

  return (
    <>
      <MotiView
        animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 8 }}
        transition={{ type: "timing", duration: 180 }}
        pointerEvents={visible ? "auto" : "none"}>
        {big ? (
          // Large: reciter centred on top, big controls beneath.
          <YStack
            gap="$1.5"
            paddingHorizontal="$4"
            paddingTop="$2"
            paddingBottom="$2.5"
            borderRadius={24}
            minWidth={300}
            backgroundColor={`${colors.background}F5`}
            borderWidth={1}
            borderColor={colors.frameColor}
            style={CARD_SHADOW}>
            <YStack alignSelf="center">{reciterButton(15, 16)}</YStack>
            <XStack alignItems="center" justifyContent="center" gap="$4">
              {downloadButton(44, 22)}
              {followToggle(44, 38, 20)}
              {playButton(54, 24)}
              {stopButton(44, 22)}
            </XStack>
          </YStack>
        ) : (
          // Default: slim one-row pill.
          <XStack
            alignItems="center"
            gap="$2"
            paddingLeft="$3"
            paddingRight="$1"
            paddingVertical="$1"
            borderRadius={999}
            backgroundColor={`${colors.background}F5`}
            borderWidth={1}
            borderColor={colors.frameColor}
            style={CARD_SHADOW}>
            {reciterButton(14, 14)}
            {downloadButton(36, 18)}
            {followToggle(38, 32, 18)}
            {playButton(40, 20)}
            {stopButton(36, 18)}
          </XStack>
        )}
      </MotiView>

      <ReaderReciterSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};

export default ReaderAudioControl;

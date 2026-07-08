import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "tamagui";
import { useTranslation } from "react-i18next";
import {
  type LucideIcon,
  Play,
  Pause,
  X,
  SkipBack,
  SkipForward,
  Repeat,
  ArrowRight,
  ArrowLeft,
  Ban,
  Moon,
  Check,
} from "lucide-react-native";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { QURAN_PLAYER_STATE, QURAN_LISTEN_MODE, type QuranListenMode } from "@/types/quran-audio";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";

const MODE_ORDER: QuranListenMode[] = [
  QURAN_LISTEN_MODE.STOP,
  QURAN_LISTEN_MODE.ADVANCE,
  QURAN_LISTEN_MODE.REPEAT_SURAH,
];
const MODE_ICON: Record<QuranListenMode, LucideIcon> = {
  [QURAN_LISTEN_MODE.STOP]: Ban,
  [QURAN_LISTEN_MODE.ADVANCE]: ArrowRight,
  [QURAN_LISTEN_MODE.REPEAT_SURAH]: Repeat,
};
const TIMER_MINUTES = [5, 10, 15, 30, 45, 60, 90, 120];

// Seconds → "m:ss", or "h:mm:ss" past an hour, in the app's numerals.
const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const loc = (n: number, pad = false) =>
    formatNumberToLocale(pad ? String(n).padStart(2, "0") : String(n));
  return h > 0 ? `${loc(h)}:${loc(m, true)}:${loc(r, true)}` : `${loc(m)}:${loc(r, true)}`;
};

// Touch x within the bar → playback fraction; the bar fills from the right in RTL.
const fracFromX = (x: number, width: number, rtl: boolean): number => {
  if (width <= 0) return 0;
  const c = Math.min(width, Math.max(0, x));
  return rtl ? 1 - c / width : c / width;
};

// Pinned transport bar, shown whenever a queue is active.
export const QuranMiniPlayer = () => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const playerState = useQuranAudioStore((s) => s.playerState);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const selectedRecitationId = useQuranAudioStore((s) => s.selectedRecitationId);
  const listenMode = useQuranAudioStore((s) => s.listenMode);
  const sleepTimerEndsAt = useQuranAudioStore((s) => s.sleepTimerEndsAt);
  const sleepTimerMinutes = useQuranAudioStore((s) => s.sleepTimerMinutes);
  const sleepTimerSurahEnd = useQuranAudioStore((s) => s.sleepTimerSurahEnd);
  const position = useQuranAudioStore((s) => s.position);
  const duration = useQuranAudioStore((s) => s.duration);
  const positionUpdatedAt = useQuranAudioStore((s) => s.positionUpdatedAt);
  const [barWidth, setBarWidth] = useState(0);
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const theme = useTheme();

  const [reciterName, setReciterName] = useState("");
  useEffect(() => {
    let alive = true;
    quranReciterRegistry.reciterOf(selectedRecitationId).then((r) => {
      if (alive) setReciterName(r ? quranReciterRegistry.localizedName(r, i18n.language) : "");
    });
    return () => {
      alive = false;
    };
  }, [selectedRecitationId, i18n.language]);

  // Live remaining minutes for a duration sleep timer (ticks once a second).
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (sleepTimerEndsAt === null) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((sleepTimerEndsAt - Date.now()) / 60000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndsAt]);

  const [timerOpen, setTimerOpen] = useState(false);

  // Advance the interpolated elapsed time each second between nitro's coarse
  // progress ticks so the scrubber and clock move smoothly.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (playerState !== QURAN_PLAYER_STATE.PLAYING) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [playerState]);

  // Drag (or tap) the bar to scrub; scrubFrac overrides the live position while
  // the finger is down, and the seek is committed from the gesture's own x.
  const seekGesture = useMemo(() => {
    // No scrubbing until the track is actually playable.
    const loading = playerState === QURAN_PLAYER_STATE.LOADING;
    const commit = (x: number) => {
      if (duration > 0) quranAudioPlayer.seekTo(fracFromX(x, barWidth, isRTL) * duration);
    };
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!loading)
      .minDistance(0)
      .onBegin((e) => setScrubFrac(fracFromX(e.x, barWidth, isRTL)))
      .onUpdate((e) => setScrubFrac(fracFromX(e.x, barWidth, isRTL)))
      .onEnd((e) => commit(e.x))
      .onFinalize(() => setScrubFrac(null));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(!loading)
      .onEnd((e) => commit(e.x));
    return Gesture.Race(pan, tap);
  }, [barWidth, isRTL, duration, playerState]);

  if (playerState === QURAN_PLAYER_STATE.IDLE) return null;

  const isPlaying = playerState === QURAN_PLAYER_STATE.PLAYING;
  const isLoading = playerState === QURAN_PLAYER_STATE.LOADING;
  const surah = currentSurah ?? 1;
  const timerActive = sleepTimerSurahEnd || sleepTimerEndsAt !== null;
  const delta =
    isPlaying && positionUpdatedAt > 0 ? Math.max(0, (now - positionUpdatedAt) / 1000) : 0;
  const elapsed = duration > 0 ? Math.min(duration, position + delta) : position;
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;
  const displayFrac = scrubFrac ?? progress;
  const currentSec = scrubFrac != null ? scrubFrac * duration : elapsed;

  // Minutes → "1h", "1h 30m", or "45m" in the app's numerals.
  const formatDuration = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const loc = (n: number) => formatNumberToLocale(String(n));
    if (h > 0 && m > 0) return t("quran.listen.timer.hoursMinutes", { h: loc(h), m: loc(m) });
    if (h > 0) return t("quran.listen.timer.hoursShort", { h: loc(h) });
    return t("quran.listen.timer.minutesShort", { m: loc(m) });
  };

  // Directional icons mirror in RTL: the layout row flips, so the skip icons swap
  // to keep "previous" pointing toward the start and "next" toward the end.
  const modeIcon =
    listenMode === QURAN_LISTEN_MODE.ADVANCE
      ? isRTL
        ? ArrowLeft
        : ArrowRight
      : MODE_ICON[listenMode];
  const prevIcon = isRTL ? SkipForward : SkipBack;
  const nextIcon = isRTL ? SkipBack : SkipForward;

  const cycleMode = () => {
    const i = MODE_ORDER.indexOf(listenMode);
    quranAudioPlayer.setListenMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]);
  };

  const applyTimer = (fn: () => void) => {
    fn();
    setTimerOpen(false);
  };

  const iconBtn = (icon: LucideIcon, onPress: () => void, label: string, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      width={44}
      height={44}
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.4 : 1}>
      <Icon as={icon} size="lg" color="$typography" />
    </Pressable>
  );

  return (
    <VStack
      gap="$2"
      paddingHorizontal="$4"
      paddingTop="$3"
      paddingBottom="$4"
      backgroundColor="$backgroundSecondary"
      borderTopWidth={1}
      borderColor="$backgroundInteractive">
      {/* Now-playing info + stop */}
      <HStack alignItems="center" gap="$2">
        <VStack flex={1}>
          <Text size="md" fontWeight="700" color="$typography" numberOfLines={1}>
            {localizedSurahName(surah)}
          </Text>
          {reciterName ? (
            <Text size="xs" color="$typographySecondary" numberOfLines={1}>
              {reciterName}
            </Text>
          ) : null}
        </VStack>
        <Pressable
          onPress={() => quranAudioPlayer.stop()}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.listen.stop")}
          hitSlop={8}
          width={32}
          height={32}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$backgroundMuted">
          <Icon as={X} size="xs" color="$typographySecondary" />
        </Pressable>
      </HStack>

      {/* Seek bar — drag or tap to scrub, with elapsed / total time */}
      <HStack alignItems="center" gap="$2" opacity={isLoading ? 0.4 : 1}>
        <Text size="xs" color="$typographySecondary" minWidth={52} textAlign="center">
          {formatTime(currentSec)}
        </Text>
        <GestureDetector gesture={seekGesture}>
          <View
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            accessibilityRole="adjustable"
            accessibilityLabel={t("a11y.quran.listen.seek")}
            style={{ flex: 1, paddingVertical: 8, justifyContent: "center" }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.backgroundInteractive.val,
              }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.accentPrimary.val,
                  width: `${displayFrac * 100}%`,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: -5,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: theme.accentPrimary.val,
                  ...(isRTL
                    ? { right: `${displayFrac * 100}%`, marginRight: -7 }
                    : { left: `${displayFrac * 100}%`, marginLeft: -7 }),
                }}
              />
            </View>
          </View>
        </GestureDetector>
        <Text size="xs" color="$typographySecondary" minWidth={52} textAlign="center">
          {formatTime(duration)}
        </Text>
      </HStack>

      {/* Mode · transport · timer */}
      <HStack alignItems="center">
        <Pressable
          onPress={cycleMode}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.listen.cycleMode")}
          flexDirection="row"
          alignItems="center"
          gap="$1"
          paddingHorizontal="$2.5"
          paddingVertical="$1.5"
          borderRadius={999}
          backgroundColor="$backgroundInteractive">
          <Icon as={modeIcon} size="xs" color="$accentPrimary" />
          <Text size="xs" color="$accentPrimary" fontWeight="600">
            {t(`quran.listen.mode.${listenMode}`)}
          </Text>
        </Pressable>

        <HStack flex={1} alignItems="center" justifyContent="center" gap="$5">
          {iconBtn(
            prevIcon,
            () => surah > 1 && quranAudioPlayer.playSurah(surah - 1),
            t("a11y.quran.listen.prevSurah"),
            surah <= 1 || isLoading
          )}
          <Pressable
            onPress={() => (isPlaying ? quranAudioPlayer.pause() : quranAudioPlayer.resume())}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={t(isPlaying ? "a11y.quran.listen.pause" : "a11y.quran.listen.play")}
            accessibilityState={{ disabled: isLoading }}
            width={56}
            height={56}
            borderRadius={28}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$accentPrimary">
            {isLoading ? (
              <Spinner size="small" color="$typographyContrast" />
            ) : (
              <Icon as={isPlaying ? Pause : Play} size="lg" color="$typographyContrast" />
            )}
          </Pressable>
          {iconBtn(
            nextIcon,
            () => surah < 114 && quranAudioPlayer.playSurah(surah + 1),
            t("a11y.quran.listen.nextSurah"),
            surah >= 114 || isLoading
          )}
        </HStack>

        <Pressable
          onPress={() => setTimerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.listen.timer")}
          flexDirection="row"
          alignItems="center"
          gap="$1"
          paddingHorizontal="$2.5"
          paddingVertical="$1.5"
          borderRadius={999}
          backgroundColor={timerActive ? "$backgroundInteractive" : "transparent"}>
          <Icon
            as={Moon}
            size="xs"
            color={timerActive ? "$accentPrimary" : "$typographySecondary"}
          />
          {sleepTimerEndsAt !== null && remaining !== null ? (
            <Text size="xs" color="$accentPrimary" fontWeight="600">
              {formatDuration(remaining)}
            </Text>
          ) : null}
        </Pressable>
      </HStack>

      <Actionsheet isOpen={timerOpen} onClose={() => setTimerOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack width="100%" paddingBottom="$2">
            <Text
              size="sm"
              fontWeight="700"
              color="$typographySecondary"
              paddingHorizontal="$4"
              paddingVertical="$2">
              {t("quran.listen.timer.title")}
            </Text>
            <ActionsheetItem onPress={() => applyTimer(() => quranAudioPlayer.setSleepOff())}>
              <ActionsheetItemText color="$typography">
                {t("quran.listen.timer.off")}
              </ActionsheetItemText>
              {!timerActive ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
            </ActionsheetItem>
            <ActionsheetItem
              onPress={() => applyTimer(() => quranAudioPlayer.setSleepAtSurahEnd())}>
              <ActionsheetItemText color="$typography">
                {t("quran.listen.timer.endOfSurah")}
              </ActionsheetItemText>
              {sleepTimerSurahEnd ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
            </ActionsheetItem>
            {TIMER_MINUTES.map((m) => (
              <ActionsheetItem
                key={m}
                onPress={() => applyTimer(() => quranAudioPlayer.setSleepAfter(m))}>
                <ActionsheetItemText color="$typography">{formatDuration(m)}</ActionsheetItemText>
                {sleepTimerMinutes === m ? (
                  <Icon as={Check} size="sm" color="$accentPrimary" />
                ) : null}
              </ActionsheetItem>
            ))}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
};

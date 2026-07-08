import { useEffect, useState } from "react";
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
const TIMER_MINUTES = [5, 10, 15, 30, 45, 60];

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
  const [barWidth, setBarWidth] = useState(0);

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

  if (playerState === QURAN_PLAYER_STATE.IDLE) return null;

  const isPlaying = playerState === QURAN_PLAYER_STATE.PLAYING;
  const isLoading = playerState === QURAN_PLAYER_STATE.LOADING;
  const surah = currentSurah ?? 1;
  const timerActive = sleepTimerSurahEnd || sleepTimerEndsAt !== null;
  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  // Tap the bar to seek. locationX is measured from the left edge; in RTL the bar
  // fills from the right, so invert.
  const seek = (locationX: number) => {
    if (duration <= 0 || barWidth <= 0) return;
    const x = Math.min(barWidth, Math.max(0, locationX));
    const frac = isRTL ? 1 - x / barWidth : x / barWidth;
    quranAudioPlayer.seekTo(frac * duration);
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

  const selectTimer = (option: "off" | "surah" | number) => {
    if (option === "off") quranAudioPlayer.setSleepOff();
    else if (option === "surah") quranAudioPlayer.setSleepAtSurahEnd();
    else quranAudioPlayer.setSleepAfter(option);
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

      {/* Seek bar — tap to scrub */}
      <Pressable
        onPress={(e) => seek(e.nativeEvent.locationX)}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={t("a11y.quran.listen.seek")}
        paddingVertical="$1.5">
        <HStack
          height={4}
          borderRadius={2}
          backgroundColor="$backgroundInteractive"
          overflow="hidden">
          <VStack
            height={4}
            borderRadius={2}
            backgroundColor="$accentPrimary"
            width={`${progress * 100}%`}
          />
        </HStack>
      </Pressable>

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
            surah <= 1
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
            surah >= 114
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
              {t("quran.listen.timer.compact", { minutes: remaining })}
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
            <ActionsheetItem onPress={() => selectTimer("off")}>
              <ActionsheetItemText color="$typography">
                {t("quran.listen.timer.off")}
              </ActionsheetItemText>
              {!timerActive ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
            </ActionsheetItem>
            <ActionsheetItem onPress={() => selectTimer("surah")}>
              <ActionsheetItemText color="$typography">
                {t("quran.listen.timer.endOfSurah")}
              </ActionsheetItemText>
              {sleepTimerSurahEnd ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
            </ActionsheetItem>
            {TIMER_MINUTES.map((m) => (
              <ActionsheetItem key={m} onPress={() => selectTimer(m)}>
                <ActionsheetItemText color="$typography">
                  {t("quran.listen.timer.minutes", { minutes: m })}
                </ActionsheetItemText>
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

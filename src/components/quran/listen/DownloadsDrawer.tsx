import { useCallback, useEffect, useMemo } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { CheckCircle2, DownloadCloud, Pause, Signal, Trash2, X } from "lucide-react-native";
import { useTheme } from "tamagui";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useRTL } from "@/contexts/RTLContext";
import { useIsCellular } from "@/hooks/useIsCellular";
import {
  useQuranDownloadStore,
  surahsForReciter,
  progressForReciter,
} from "@/stores/quranDownload";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatFileSizeLocale, formatNumberToLocale } from "@/utils/number";
import type { QuranRecitation } from "@/types/quran-audio";

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);
const WIDTH_FRACTION = 0.86;
const SPRING = { damping: 26, stiffness: 240, overshootClamping: true } as const;

// A slim horizontal fill bar (0..1).
const ProgressBar = ({ frac }: { frac: number }) => (
  <HStack height={6} borderRadius={3} backgroundColor="$backgroundInteractive" overflow="hidden">
    <VStack
      width={`${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`}
      height={6}
      borderRadius={3}
      backgroundColor="$accentPrimary"
    />
  </HStack>
);

type QueueRowProps = {
  surah: number;
  paused: boolean;
  frac: number;
  size: number;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
};

const QueueRow = ({ surah, paused, frac, size, onPause, onResume, onCancel }: QueueRowProps) => {
  const { t } = useTranslation();
  const scriptFont = metadataFontFamily();
  const pct = formatNumberToLocale(String(Math.round(Math.min(1, Math.max(0, frac)) * 100)));
  return (
    <HStack alignItems="center" gap="$3" paddingVertical="$2">
      <VStack flex={1} gap="$1.5">
        <HStack alignItems="center" justifyContent="space-between" gap="$2">
          <HStack flex={1} alignItems="center" gap="$1.5">
            <Text
              size="sm"
              fontWeight="600"
              color="$typography"
              numberOfLines={1}
              style={scriptFont ? { fontFamily: scriptFont } : undefined}>
              {localizedSurahName(surah)}
            </Text>
            {size > 0 ? (
              <Text size="xs" color="$typographySecondary">
                {formatFileSizeLocale(size, t)}
              </Text>
            ) : null}
          </HStack>
          <Text
            size="xs"
            color={paused ? "$typographySecondary" : "$accentPrimary"}
            fontWeight="600">
            {paused ? t("quran.listen.paused") : `${pct}%`}
          </Text>
        </HStack>
        <ProgressBar frac={frac} />
      </VStack>

      <Pressable
        onPress={paused ? onResume : onPause}
        hitSlop={8}
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        accessibilityRole="button"
        accessibilityLabel={
          paused ? t("a11y.quran.listen.resumeDownload") : t("a11y.quran.listen.pauseDownload")
        }>
        <Icon as={paused ? DownloadCloud : Pause} size="sm" color="$accentPrimary" />
      </Pressable>
      <Pressable
        onPress={onCancel}
        hitSlop={8}
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        accessibilityRole="button"
        accessibilityLabel={t("a11y.quran.listen.cancelDownload")}>
        <Icon as={X} size="sm" color="$typographySecondary" />
      </Pressable>
    </HStack>
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
  recitation: QuranRecitation | null;
  sizeOf: (surah: number) => number; // per-surah size (bytes)
};

// A trailing-edge side panel, opened from the header cloud icon, showing the live
// download queue: overall count + a per-surah progress row for every surah being
// downloaded or paused (individually or via download-all), plus reciter-level
// download-all / delete-all controls. Slide-in only (button, scrim, or back);
// mirrors ReaderLibraryDrawer's animation.
export const DownloadsDrawer = ({ open, onClose, recitation, sizeOf }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCellular = useIsCellular();

  const downloading = useQuranDownloadStore((s) => s.downloading);
  const progress = useQuranDownloadStore((s) => s.progress);
  const resumeStates = useQuranDownloadStore((s) => s.resumeStates);
  const downloaded = useQuranDownloadStore((s) => s.downloaded);
  const allActive = useQuranDownloadStore((s) => s.allActive);
  const allDone = useQuranDownloadStore((s) => s.allDone);
  const allTotal = useQuranDownloadStore((s) => s.allTotal);
  const bytes = useQuranDownloadStore((s) => s.bytes);
  const downloadAll = useQuranDownloadStore((s) => s.downloadAll);
  const cancelAll = useQuranDownloadStore((s) => s.cancelAll);
  const deleteAll = useQuranDownloadStore((s) => s.deleteAll);
  const downloadOne = useQuranDownloadStore((s) => s.downloadOne);
  const pauseOne = useQuranDownloadStore((s) => s.pauseOne);
  const deleteOne = useQuranDownloadStore((s) => s.deleteOne);

  const recId = recitation?.id ?? null;
  // This reciter's in-flight surahs + per-surah progress, sliced from the
  // composite-keyed store state.
  const downloadingSet = useMemo(
    () => new Set(surahsForReciter(downloading, recId)),
    [downloading, recId]
  );
  const progressBySurah = useMemo(() => progressForReciter(progress, recId), [progress, recId]);

  // Surahs with a saved resume point but no longer in flight = paused.
  const pausedSet = useMemo(() => {
    const out = new Set<number>();
    if (!recId) return out;
    const prefix = `${recId}:`;
    for (const k of Object.keys(resumeStates)) {
      if (k.startsWith(prefix)) {
        const n = Number(k.slice(prefix.length));
        if (!downloadingSet.has(n)) out.add(n);
      }
    }
    return out;
  }, [resumeStates, recId, downloadingSet]);

  const queue = useMemo(
    () => [...new Set([...downloadingSet, ...pausedSet])].sort((a, b) => a - b),
    [downloadingSet, pausedSet]
  );

  const drawerW = Math.round(width * WIDTH_FRACTION);
  // translateX is physical (RN doesn't RTL-flip transforms); the panel is anchored
  // to the leading edge, so it hides off toward whichever edge `start` sits on.
  const hiddenX = isRTL ? drawerW : -drawerW;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.set(withSpring(open ? 1 : 0, SPRING));
  }, [open, anim]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(anim.get(), [0, 1], [hiddenX, 0], Extrapolation.CLAMP) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: anim.get() * 0.4 }));

  const allDownloaded = downloaded.length >= SURAHS.length;
  const allFrac = allTotal > 0 ? allDone / allTotal : 0;

  // Cost of "download all": the estimated size of every surah not yet saved.
  const remainingBytes = useMemo(() => {
    let sum = 0;
    for (const n of SURAHS) if (!downloaded.includes(n)) sum += sizeOf(n);
    return sum;
  }, [downloaded, sizeOf]);

  const confirmDeleteAll = useCallback(() => {
    if (!recitation) return;
    Alert.alert(t("quran.listen.deleteAllTitle"), t("quran.listen.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("quran.listen.deleteAll"),
        style: "destructive",
        onPress: () => deleteAll(recitation),
      },
    ]);
  }, [recitation, deleteAll, t]);

  const startDownloadAll = useCallback(() => {
    if (!recitation) return;
    if (isCellular) {
      Alert.alert(t("quran.listen.cellularTitle"), t("quran.listen.cellularBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("quran.listen.downloadAll"), onPress: () => downloadAll(recitation, SURAHS) },
      ]);
    } else {
      downloadAll(recitation, SURAHS);
    }
  }, [recitation, isCellular, downloadAll, t]);

  return (
    <>
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", zIndex: 100 }, scrimStyle]}>
        <Pressable
          flex={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            start: 0,
            width: drawerW,
            zIndex: 110,
            backgroundColor: theme.background.val,
          },
          panelStyle,
        ]}>
        <VStack flex={1} paddingTop={insets.top}>
          <HStack
            alignItems="center"
            gap="$3"
            paddingHorizontal="$4"
            paddingVertical="$3"
            borderBottomWidth={1}
            borderBottomColor="$backgroundInteractive">
            <VStack flex={1} gap="$0.5">
              <Text size="xl" fontWeight="700" color="$typography">
                {t("quran.listen.manageTitle")}
              </Text>
              <Text size="xs" color="$typographySecondary">
                {t("quran.listen.downloadedCount", {
                  done: formatNumberToLocale(String(downloaded.length)),
                  total: formatNumberToLocale(String(SURAHS.length)),
                })}
                {" · "}
                {formatFileSizeLocale(bytes, t)}
              </Text>
            </VStack>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              width={36}
              height={36}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}>
              <Icon as={X} size="md" color="$typography" />
            </Pressable>
          </HStack>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <VStack gap="$4">
              {allActive ? (
                <VStack
                  gap="$2"
                  padding="$3"
                  borderRadius="$4"
                  backgroundColor="$backgroundInteractive">
                  <HStack alignItems="center" justifyContent="space-between">
                    <Text size="sm" fontWeight="700" color="$typography">
                      {t("quran.listen.downloadingAll")}
                    </Text>
                    <Pressable
                      onPress={cancelAll}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.cancel")}>
                      <Text size="sm" fontWeight="600" color="$accentPrimary">
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                  </HStack>
                  <Text size="xs" color="$typographySecondary">
                    {t("quran.listen.downloadingCount", {
                      done: formatNumberToLocale(String(allDone)),
                      total: formatNumberToLocale(String(allTotal)),
                    })}
                  </Text>
                  <ProgressBar frac={allFrac} />
                </VStack>
              ) : (
                <Pressable
                  onPress={startDownloadAll}
                  disabled={allDownloaded}
                  opacity={allDownloaded ? 0.5 : 1}
                  flexDirection="row"
                  alignItems="center"
                  gap="$3"
                  paddingVertical="$2"
                  accessibilityRole="button"
                  accessibilityLabel={t("quran.listen.downloadAll")}>
                  <Icon
                    as={allDownloaded ? CheckCircle2 : DownloadCloud}
                    size="md"
                    color="$accentPrimary"
                  />
                  <VStack>
                    <Text size="md" fontWeight="600" color="$accentPrimary">
                      {allDownloaded
                        ? t("quran.listen.allDownloaded")
                        : t("quran.listen.downloadAll")}
                    </Text>
                    {!allDownloaded && remainingBytes > 0 ? (
                      <Text size="xs" color="$typographySecondary">
                        {formatFileSizeLocale(remainingBytes, t)}
                      </Text>
                    ) : null}
                  </VStack>
                </Pressable>
              )}

              {isCellular && !allDownloaded ? (
                <HStack alignItems="center" gap="$1.5">
                  <Icon as={Signal} size="xs" color="$typographySecondary" />
                  <Text size="xs" color="$typographySecondary">
                    {t("quran.listen.cellularWarning")}
                  </Text>
                </HStack>
              ) : null}

              {queue.length > 0 ? (
                <VStack gap="$1">
                  <Text
                    size="xs"
                    fontWeight="700"
                    color="$typographySecondary"
                    textTransform="uppercase">
                    {t("quran.listen.inProgress")}
                  </Text>
                  {queue.map((n) => (
                    <QueueRow
                      key={n}
                      surah={n}
                      paused={pausedSet.has(n)}
                      frac={progressBySurah[n] ?? 0}
                      size={sizeOf(n)}
                      onPause={() => recitation && pauseOne(recitation, n)}
                      onResume={() => recitation && void downloadOne(recitation, n)}
                      onCancel={() => recitation && deleteOne(recitation, n)}
                    />
                  ))}
                </VStack>
              ) : (
                <Text
                  size="sm"
                  color="$typographySecondary"
                  textAlign="center"
                  paddingVertical="$4">
                  {t("quran.listen.noActiveDownloads")}
                </Text>
              )}
            </VStack>
          </ScrollView>

          {downloaded.length > 0 ? (
            <HStack
              alignItems="center"
              justifyContent="center"
              borderTopWidth={1}
              borderTopColor="$backgroundInteractive"
              paddingHorizontal="$4"
              paddingTop="$3"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
              <Pressable
                onPress={confirmDeleteAll}
                flexDirection="row"
                alignItems="center"
                gap="$2"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.deleteAll")}>
                <Icon as={Trash2} size="md" color="$error" />
                <Text size="md" fontWeight="600" color="$error">
                  {t("quran.listen.deleteAll")}
                </Text>
              </Pressable>
            </HStack>
          ) : null}
        </VStack>
      </Animated.View>
    </>
  );
};

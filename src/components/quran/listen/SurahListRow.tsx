import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Download, CheckCircle2, Pause, Headphones } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "tamagui";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { RevelationPlace } from "@/enums/quran";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { SURAH_AYAH_COUNTS, SURAH_REVELATION_PLACES } from "@/constants/Quran";
import { formatFileSizeLocale, formatNumberToLocale } from "@/utils/number";

type Props = {
  surah: number;
  isCurrent: boolean;
  isLoading: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  isPaused: boolean; // interrupted transfer with a saved resume point
  downloadProgress?: number; // 0..1 while downloading
  estimatedBytes?: number; // download size in bytes
  onPress: (surah: number) => void;
  onDownload: (surah: number) => void; // fresh download OR resume a paused one
  onPause: (surah: number) => void;
  onDelete: (surah: number) => void;
};

// Compact circular download-progress indicator.
const RING = 26;
const RADIUS = 10;
const CIRC = 2 * Math.PI * RADIUS;
const DownloadRing = ({ fraction, showPause }: { fraction: number; showPause?: boolean }) => {
  const theme = useTheme();
  return (
    <VStack width={RING} height={RING} alignItems="center" justifyContent="center">
      <Svg width={RING} height={RING} style={{ position: "absolute" }}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={theme.backgroundInteractive.val}
          strokeWidth={2.5}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={theme.accentPrimary.val}
          strokeWidth={2.5}
          fill="none"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={CIRC * (1 - Math.min(1, Math.max(0, fraction)))}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING / 2}, ${RING / 2}`}
        />
      </Svg>
      {showPause ? <Icon as={Pause} size="xs" color="$accentPrimary" /> : null}
    </VStack>
  );
};

const SurahListRowBase = ({
  surah,
  isCurrent,
  isLoading,
  isDownloaded,
  isDownloading,
  isPaused,
  downloadProgress,
  estimatedBytes,
  onPress,
  onDownload,
  onPause,
  onDelete,
}: Props) => {
  const { t } = useTranslation();
  const scriptFont = metadataFontFamily();
  const name = localizedSurahName(surah);

  const meccaOrMedina =
    SURAH_REVELATION_PLACES[surah] === RevelationPlace.MAKKAH
      ? t("quran.surah.makki")
      : t("quran.surah.madani");
  const sizeLabel =
    estimatedBytes && estimatedBytes > 0 ? formatFileSizeLocale(estimatedBytes, t) : null;
  const metaLine = [
    t("quran.surah.ayahCount", {
      n: formatNumberToLocale(String(SURAH_AYAH_COUNTS[surah])),
    }),
    meccaOrMedina,
    sizeLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => onPress(surah)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={t("a11y.quran.listen.playSurah")}
      accessibilityState={{ selected: isCurrent }}>
      <HStack
        alignItems="center"
        gap="$3"
        paddingVertical="$2.5"
        paddingHorizontal="$2.5"
        borderRadius="$4"
        backgroundColor={isCurrent ? "$backgroundInteractive" : "transparent"}>
        <VStack
          width={40}
          height={40}
          borderRadius={20}
          alignItems="center"
          justifyContent="center"
          borderWidth={1.5}
          borderColor={isCurrent ? "$accentPrimary" : "$backgroundInteractive"}>
          <Text
            size="sm"
            fontWeight="700"
            color={isCurrent ? "$accentPrimary" : "$typographySecondary"}>
            {formatNumberToLocale(String(surah))}
          </Text>
        </VStack>

        <VStack flex={1} gap="$0.5">
          <Text
            size="lg"
            fontWeight="600"
            color={isCurrent ? "$accentPrimary" : "$typography"}
            numberOfLines={1}
            style={scriptFont ? { fontFamily: scriptFont } : undefined}>
            {name}
          </Text>
          {metaLine ? (
            <Text size="xs" color="$typographySecondary" numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
        </VStack>

        <HStack alignItems="center" gap="$2">
          {/* Tap-to-listen affordance; the whole row plays on press. */}
          {isLoading ? (
            <Spinner size="small" color="$accentPrimary" />
          ) : isCurrent ? (
            <Icon as={AudioLines} size="sm" color="$accentPrimary" />
          ) : (
            <Icon as={Headphones} size="sm" color="$typographySecondary" />
          )}

          {isDownloading ? (
            // Tap to pause; a paused transfer keeps its partial file and resumes.
            <Pressable
              onPress={() => onPause(surah)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.quran.listen.pauseDownload")}
              width={30}
              height={30}
              alignItems="center"
              justifyContent="center">
              {downloadProgress && downloadProgress > 0 ? (
                <DownloadRing fraction={downloadProgress} showPause />
              ) : (
                <Spinner size="small" color="$typographySecondary" />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => (isDownloaded ? onDelete(surah) : onDownload(surah))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isDownloaded
                  ? t("a11y.quran.listen.deleteDownload")
                  : isPaused
                    ? t("a11y.quran.listen.resumeDownload")
                    : t("a11y.quran.listen.download")
              }
              width={30}
              height={30}
              alignItems="center"
              justifyContent="center">
              <Icon
                as={isDownloaded ? CheckCircle2 : Download}
                size="sm"
                color={isDownloaded || isPaused ? "$accentPrimary" : "$typographySecondary"}
              />
            </Pressable>
          )}
        </HStack>
      </HStack>
    </Pressable>
  );
};

export const SurahListRow = memo(SurahListRowBase);

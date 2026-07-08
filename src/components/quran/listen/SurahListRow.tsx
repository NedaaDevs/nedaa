import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Download, CheckCircle2 } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { RevelationPlace } from "@/enums/quran";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import type { SurahMeta } from "@/types/quran";

type Props = {
  surah: number;
  meta?: SurahMeta;
  isCurrent: boolean;
  isLoading: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  onPress: (surah: number) => void;
  onDownload: (surah: number) => void;
  onDelete: (surah: number) => void;
};

const SurahListRowBase = ({
  surah,
  meta,
  isCurrent,
  isLoading,
  isDownloaded,
  isDownloading,
  onPress,
  onDownload,
  onDelete,
}: Props) => {
  const { t } = useTranslation();
  const scriptFont = metadataFontFamily();
  const name = localizedSurahName(surah);

  const meccaOrMedina = meta
    ? meta.revelationPlace === RevelationPlace.MAKKAH
      ? t("quran.surah.makki")
      : t("quran.surah.madani")
    : null;
  const metaLine = meta
    ? `${t("quran.surah.ayahCount", { n: formatNumberToLocale(String(meta.ayahCount)) })} · ${meccaOrMedina}`
    : null;

  return (
    <Pressable
      onPress={() => onPress(surah)}
      accessibilityRole="button"
      accessibilityLabel={name}
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
          {isLoading ? (
            <Spinner size="small" color="$accentPrimary" />
          ) : isCurrent ? (
            <Icon as={AudioLines} size="sm" color="$accentPrimary" />
          ) : null}

          {isDownloading ? (
            <Spinner size="small" color="$typographySecondary" />
          ) : (
            <Pressable
              onPress={() => (isDownloaded ? onDelete(surah) : onDownload(surah))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isDownloaded
                  ? t("a11y.quran.listen.deleteDownload")
                  : t("a11y.quran.listen.download")
              }
              width={30}
              height={30}
              alignItems="center"
              justifyContent="center">
              <Icon
                as={isDownloaded ? CheckCircle2 : Download}
                size="sm"
                color={isDownloaded ? "$accentPrimary" : "$typographySecondary"}
              />
            </Pressable>
          )}
        </HStack>
      </HStack>
    </Pressable>
  );
};

export const SurahListRow = memo(SurahListRowBase);

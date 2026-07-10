import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { AlignJustify, Check, Highlighter, Trash2, type LucideIcon } from "lucide-react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranAudioDownload } from "@/services/quran-audio/quranAudioDownload";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranReciter } from "@/types/quran-audio";
import { localizedSurahName } from "@/utils/surahName";
import { formatFileSizeLocale } from "@/utils/number";

// A reciter capability badge (word-by-word / verse-by-verse highlight support).
const CapabilityChip = ({
  icon,
  accent,
  label,
}: {
  icon: LucideIcon;
  accent?: boolean;
  label: string;
}) => {
  const color = accent ? ("$accentPrimary" as const) : ("$typographySecondary" as const);
  return (
    <HStack
      alignItems="center"
      gap="$1"
      paddingHorizontal="$2"
      paddingVertical="$0.5"
      borderRadius="$2"
      backgroundColor="$backgroundInteractive">
      <Icon as={icon} size="xs" color={color} />
      <Text size="xs" fontWeight="600" color={color}>
        {label}
      </Text>
    </HStack>
  );
};

// Picks the reader recitation — ayah-granular reciters only (the only ones that
// can drive per-ayah/word read-along). Switching mid-playback continues from the
// current ayah with the new reciter.
export const ReaderReciterSheet = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const readerRecitationId = useQuranAudioStore((s) => s.readerRecitationId);
  const setReaderRecitation = useQuranAudioStore((s) => s.setReaderRecitation);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  // The selected recitation's offline surahs (per-ayah files), for management.
  const [downloads, setDownloads] = useState<{ surah: number; bytes: number }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    quranReciterRegistry.readerReciters().then((r) => {
      if (alive) setReciters(r);
    });
    quranReciterRegistry.getRecitationById(readerRecitationId).then((rec) => {
      if (alive)
        setDownloads(rec ? quranAudioDownload.downloadedAyahSurahs(rec.id, rec.fileFormat) : []);
    });
    return () => {
      alive = false;
    };
  }, [isOpen, readerRecitationId]);

  const deleteDownload = async (surah: number) => {
    const rec = await quranReciterRegistry.getRecitationById(readerRecitationId);
    if (!rec) return;
    quranAudioDownload.deleteAyahSurah(rec.id, surah, rec.fileFormat);
    setDownloads(quranAudioDownload.downloadedAyahSurahs(rec.id, rec.fileFormat));
  };

  const select = (recitationId: string) => {
    setReaderRecitation(recitationId);
    // Continue playback with the new reciter from the current ayah, if any.
    const s = useQuranAudioStore.getState();
    if (
      s.playerState !== QURAN_PLAYER_STATE.IDLE &&
      s.currentSurah != null &&
      s.currentAyah != null
    ) {
      void quranAudioPlayer.playFromHere(s.currentSurah, s.currentAyah);
    }
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack width="100%" paddingHorizontal="$4" paddingTop="$2" paddingBottom="$6" gap="$3">
          <Text size="lg" fontWeight="700" color="$typography">
            {t("quran.reader.chooseReciter")}
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            <VStack gap="$2">
              {reciters.flatMap((r) => {
                const name = quranReciterRegistry.localizedName(r, i18n.language);
                return r.recitations.map((rec) => {
                  const selected = rec.id === readerRecitationId;
                  return (
                    <Pressable
                      key={rec.id}
                      onPress={() => select(rec.id)}
                      flexDirection="row"
                      alignItems="center"
                      gap="$3"
                      padding="$3"
                      borderRadius="$4"
                      backgroundColor={selected ? "$backgroundInteractive" : "$backgroundSecondary"}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={
                        rec.timings
                          ? t("a11y.quran.reciterWordByWord", { name })
                          : t("a11y.quran.reciterAyahByAyah", { name })
                      }>
                      <VStack
                        width={44}
                        height={44}
                        borderRadius={22}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="$backgroundInteractive">
                        <Text size="lg" fontWeight="700" color="$typography">
                          {name.charAt(0)}
                        </Text>
                      </VStack>
                      <VStack flex={1} gap="$0.5">
                        <Text size="md" fontWeight="600" color="$typography" numberOfLines={1}>
                          {name}
                        </Text>
                        <Text size="xs" color="$typographySecondary">
                          {t(`quran.listen.style.${rec.style.toLowerCase()}`, rec.style)}
                        </Text>
                        {/* Word-timed reciters support both highlight modes — show both. */}
                        <HStack alignSelf="flex-start" gap="$1.5" marginTop="$0.5">
                          {rec.timings ? (
                            <CapabilityChip
                              icon={Highlighter}
                              accent
                              label={t("quran.reader.wordByWord")}
                            />
                          ) : null}
                          <CapabilityChip
                            icon={AlignJustify}
                            label={t("quran.reader.ayahByAyah")}
                          />
                        </HStack>
                      </VStack>
                      {selected ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
                    </Pressable>
                  );
                });
              })}
            </VStack>

            {/* Offline surahs saved for the selected reciter, with per-surah delete. */}
            {downloads.length > 0 ? (
              <VStack gap="$2" marginTop="$4">
                <Text size="sm" fontWeight="700" color="$typographySecondary">
                  {t("quran.reader.downloadedSurahs")}
                </Text>
                {downloads.map(({ surah, bytes }) => (
                  <HStack
                    key={surah}
                    alignItems="center"
                    gap="$3"
                    paddingVertical="$1.5"
                    paddingHorizontal="$3"
                    borderRadius="$3"
                    backgroundColor="$backgroundSecondary">
                    <Text size="sm" fontWeight="600" color="$typography" flex={1}>
                      {localizedSurahName(surah)}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {formatFileSizeLocale(bytes, t)}
                    </Text>
                    <Pressable
                      onPress={() => void deleteDownload(surah)}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.quran.listen.deleteDownload")}
                      hitSlop={8}>
                      <Icon as={Trash2} size="sm" color="$typographySecondary" />
                    </Pressable>
                  </HStack>
                ))}
              </VStack>
            ) : null}
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

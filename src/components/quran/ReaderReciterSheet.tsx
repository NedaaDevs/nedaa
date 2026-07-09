import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, Highlighter } from "lucide-react-native";

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
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranReciter } from "@/types/quran-audio";

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
  const selectedRecitationId = useQuranAudioStore((s) => s.selectedRecitationId);
  const setSelectedRecitation = useQuranAudioStore((s) => s.setSelectedRecitation);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    quranReciterRegistry.readerReciters().then((r) => {
      if (alive) setReciters(r);
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const select = (recitationId: string) => {
    setSelectedRecitation(recitationId);
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
                  const selected = rec.id === selectedRecitationId;
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
                        rec.timings ? t("a11y.quran.reciterWordByWord", { name }) : name
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
                        {rec.timings ? (
                          <HStack
                            alignSelf="flex-start"
                            alignItems="center"
                            gap="$1"
                            marginTop="$0.5"
                            paddingHorizontal="$2"
                            paddingVertical="$0.5"
                            borderRadius="$2"
                            backgroundColor="$backgroundInteractive">
                            <Icon as={Highlighter} size="xs" color="$accentPrimary" />
                            <Text size="xs" fontWeight="600" color="$accentPrimary">
                              {t("quran.reader.wordByWord")}
                            </Text>
                          </HStack>
                        ) : null}
                      </VStack>
                      {selected ? <Icon as={Check} size="sm" color="$accentPrimary" /> : null}
                    </Pressable>
                  );
                });
              })}
            </VStack>
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

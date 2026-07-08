import { useEffect } from "react";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

const QuranListenSurahsScreen = () => {
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const playerState = useQuranAudioStore((s) => s.playerState);

  // Warm the CDN connection and manifest cache so the first surah tap starts fast.
  useEffect(() => {
    void quranAudioPlayer.warmUp();
  }, []);

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/quran-listen" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 12, flexGrow: 1 }}>
        <VStack>
          {SURAHS.map((n) => {
            const isLoadingRow = playerState === QURAN_PLAYER_STATE.LOADING && currentSurah === n;
            return (
              <Pressable
                key={n}
                onPress={() => quranAudioPlayer.playSurah(n)}
                accessibilityRole="button"
                accessibilityLabel={localizedSurahName(n)}
                accessibilityState={{ selected: currentSurah === n }}>
                <HStack alignItems="center" gap="$3" paddingVertical="$3" paddingHorizontal="$2">
                  <HStack width={32} alignItems="center" justifyContent="center">
                    {isLoadingRow ? (
                      <Spinner size="small" color="$accentPrimary" />
                    ) : (
                      <Text size="sm" color="$typographySecondary">
                        {formatNumberToLocale(String(n))}
                      </Text>
                    )}
                  </HStack>
                  <Text
                    color={currentSurah === n ? "$accentPrimary" : "$typography"}
                    fontWeight={currentSurah === n ? "700" : "400"}>
                    {localizedSurahName(n)}
                  </Text>
                </HStack>
              </Pressable>
            );
          })}
        </VStack>
      </ScrollView>
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenSurahsScreen;

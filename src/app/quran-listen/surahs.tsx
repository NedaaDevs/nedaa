import { useEffect } from "react";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

const QuranListenSurahsScreen = () => {
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);

  // Warm the CDN connection and manifest cache so the first surah tap starts fast.
  useEffect(() => {
    void quranAudioPlayer.warmUp();
  }, []);

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/quran-listen" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 12, flexGrow: 1 }}>
        <VStack>
          {SURAHS.map((n) => (
            <Pressable
              key={n}
              onPress={() => quranAudioPlayer.playSurah(n)}
              accessibilityRole="button"
              accessibilityLabel={localizedSurahName(n)}
              accessibilityState={{ selected: currentSurah === n }}>
              <HStack alignItems="center" gap="$3" paddingVertical="$3" paddingHorizontal="$2">
                <Text size="sm" color="$typographySecondary" width={32}>
                  {formatNumberToLocale(String(n))}
                </Text>
                <Text
                  color={currentSurah === n ? "$accentPrimary" : "$typography"}
                  fontWeight={currentSurah === n ? "700" : "400"}>
                  {localizedSurahName(n)}
                </Text>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      </ScrollView>
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenSurahsScreen;

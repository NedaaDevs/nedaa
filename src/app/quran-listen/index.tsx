import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { useQuranAudioStore } from "@/stores/quranAudio";
import type { QuranReciter } from "@/types/quran-audio";

const QuranListenScreen = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const setSelectedRecitation = useQuranAudioStore((s) => s.setSelectedRecitation);
  const [reciters, setReciters] = useState<QuranReciter[] | null>(null);

  useEffect(() => {
    quranReciterRegistry.listenReciters().then(setReciters);
  }, []);

  const openRecitation = (recitationId: string) => {
    setSelectedRecitation(recitationId);
    router.push("/quran-listen/surahs");
  };

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/(tabs)/tools" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 12, flexGrow: 1 }}>
        <VStack gap="$3">
          {reciters === null && (
            <HStack paddingVertical="$6" justifyContent="center">
              <Spinner size="large" color="$accentPrimary" />
            </HStack>
          )}
          {reciters?.length === 0 && (
            <Text color="$typographySecondary">{t("quran.listen.empty")}</Text>
          )}
          {reciters?.map((r) => (
            <VStack key={r.id} gap="$1.5">
              <Text size="md" fontWeight="700" color="$typography">
                {quranReciterRegistry.localizedName(r, i18n.language)}
              </Text>
              <Card padding="$2">
                <VStack>
                  {r.recitations.map((rec) => (
                    <Pressable
                      key={rec.id}
                      onPress={() => openRecitation(rec.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        `quran.listen.style.${rec.style.toLowerCase()}`,
                        rec.style
                      )}>
                      <HStack
                        alignItems="center"
                        justifyContent="space-between"
                        paddingVertical="$3"
                        paddingHorizontal="$2">
                        <Text color="$typography">
                          {t(`quran.listen.style.${rec.style.toLowerCase()}`, rec.style)}
                        </Text>
                        <Icon as={ChevronRight} size="sm" color="$typographySecondary" />
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              </Card>
            </VStack>
          ))}
        </VStack>
      </ScrollView>
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenScreen;

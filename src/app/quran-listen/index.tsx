import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft, Check } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { useRTL } from "@/contexts/RTLContext";
import type { QuranReciter } from "@/types/quran-audio";

type LoadStatus = "loading" | "error" | "ready";

const QuranListenScreen = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const setSelectedRecitation = useQuranAudioStore((s) => s.setSelectedRecitation);
  const selectedRecitationId = useQuranAudioStore((s) => s.selectedRecitationId);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A rejection (rather than an empty list) surfaces the error state so a network
  // failure is distinguishable from "no reciters yet" and can be retried.
  const fetchReciters = useCallback(() => {
    quranReciterRegistry
      .listenReciters()
      .then((r) => {
        if (!mounted.current) return;
        setReciters(r);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted.current) setStatus("error");
      });
  }, []);

  useEffect(() => fetchReciters(), [fetchReciters]);

  const retry = () => {
    setStatus("loading");
    fetchReciters();
  };

  const openRecitation = (recitationId: string) => {
    setSelectedRecitation(recitationId);
    router.push("/quran-listen/surahs");
  };

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/(tabs)/tools" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 12, flexGrow: 1 }}>
        <VStack gap="$3">
          {status === "loading" && (
            <HStack paddingVertical="$6" justifyContent="center">
              <Spinner size="large" color="$accentPrimary" />
            </HStack>
          )}
          {status === "error" && (
            <VStack paddingVertical="$6" gap="$3" alignItems="center">
              <Text color="$typographySecondary" textAlign="center">
                {t("quran.listen.error")}
              </Text>
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.retry")}
                paddingHorizontal="$4"
                paddingVertical="$2.5"
                borderRadius={999}
                backgroundColor="$accentPrimary">
                <Text color="$typographyContrast" fontWeight="600">
                  {t("quran.listen.retry")}
                </Text>
              </Pressable>
            </VStack>
          )}
          {status === "ready" && reciters.length === 0 && (
            <Text color="$typographySecondary">{t("quran.listen.empty")}</Text>
          )}
          {reciters.map((r) => {
            const name = quranReciterRegistry.localizedName(r, i18n.language);
            return r.recitations.map((rec) => {
              const selected = rec.id === selectedRecitationId;
              return (
                <Pressable
                  key={rec.id}
                  onPress={() => openRecitation(rec.id)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityState={{ selected }}>
                  <HStack
                    alignItems="center"
                    gap="$3"
                    padding="$3"
                    borderRadius="$6"
                    backgroundColor={selected ? "$accentPrimary" : "$backgroundSecondary"}
                    borderWidth={1}
                    borderColor={selected ? "$accentPrimary" : "$backgroundInteractive"}>
                    <VStack
                      width={48}
                      height={48}
                      borderRadius={24}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor={
                        selected ? "$backgroundSecondary" : "$backgroundInteractive"
                      }>
                      <Text
                        size="lg"
                        fontWeight="700"
                        color={selected ? "$accentPrimary" : "$typography"}>
                        {name.charAt(0)}
                      </Text>
                    </VStack>
                    <VStack flex={1} gap="$0.5">
                      <Text
                        size="md"
                        fontWeight="700"
                        color={selected ? "$typographyContrast" : "$typography"}
                        numberOfLines={1}>
                        {name}
                      </Text>
                      <Text
                        size="xs"
                        color={selected ? "$typographyContrast" : "$typographySecondary"}
                        numberOfLines={1}>
                        {t(`quran.listen.style.${rec.style.toLowerCase()}`, rec.style)}
                      </Text>
                    </VStack>
                    <Icon
                      as={selected ? Check : isRTL ? ChevronLeft : ChevronRight}
                      size="sm"
                      color={selected ? "$typographyContrast" : "$typographySecondary"}
                    />
                  </HStack>
                </Pressable>
              );
            });
          })}
        </VStack>
      </ScrollView>
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenScreen;

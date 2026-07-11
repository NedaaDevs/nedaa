import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft, Check, FlaskConical } from "lucide-react-native";
import { keyboardFilter } from "miftah";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { ListenSearchBar } from "@/components/quran/listen/ListenSearchBar";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { useRTL } from "@/contexts/RTLContext";
import type { QuranReciter } from "@/types/quran-audio";

const LOAD_STATUS = { LOADING: "loading", ERROR: "error", READY: "ready" } as const;
type LoadStatus = (typeof LOAD_STATUS)[keyof typeof LOAD_STATUS];

// Match a reciter by either script name; miftah covers Latin ("husary"),
// Arabic-keyboard mistypes, and phonetic input.
const matchesReciter = (r: QuranReciter, q: string): boolean =>
  keyboardFilter(r.nameArabic, q) || keyboardFilter(r.nameEnglish, q);

const QuranListenScreen = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const setListenRecitation = useQuranAudioStore((s) => s.setListenRecitation);
  const listenRecitationId = useQuranAudioStore((s) => s.listenRecitationId);
  const [status, setStatus] = useState<LoadStatus>(LOAD_STATUS.LOADING);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const [query, setQuery] = useState("");
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
        setStatus(LOAD_STATUS.READY);
      })
      .catch(() => {
        if (mounted.current) setStatus(LOAD_STATUS.ERROR);
      });
  }, []);

  useEffect(() => fetchReciters(), [fetchReciters]);

  const retry = () => {
    setStatus(LOAD_STATUS.LOADING);
    fetchReciters();
  };

  const openRecitation = (recitationId: string) => {
    setListenRecitation(recitationId);
    router.push("/quran-listen/surahs");
  };

  const filtered = useMemo(
    () => (query.trim() === "" ? reciters : reciters.filter((r) => matchesReciter(r, query))),
    [reciters, query]
  );

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/(tabs)/tools" backOnClick />
      {status === LOAD_STATUS.READY && reciters.length > 0 ? (
        <VStack paddingHorizontal="$3" paddingTop="$2">
          <ListenSearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t("quran.listen.searchReciter")}
          />
        </VStack>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <VStack gap="$3">
          {status === LOAD_STATUS.LOADING && (
            <HStack paddingVertical="$6" justifyContent="center">
              <Spinner size="large" color="$accentPrimary" />
            </HStack>
          )}
          {status === LOAD_STATUS.ERROR && (
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
          {status === LOAD_STATUS.READY && reciters.length === 0 && (
            <Text color="$typographySecondary">{t("quran.listen.empty")}</Text>
          )}
          {status === LOAD_STATUS.READY && reciters.length > 0 && filtered.length === 0 && (
            <Text color="$typographySecondary" textAlign="center" paddingVertical="$4">
              {t("quran.listen.noResults")}
            </Text>
          )}
          {filtered.map((r) => {
            const name = quranReciterRegistry.localizedName(r, i18n.language);
            return r.recitations.map((rec) => {
              const selected = rec.id === listenRecitationId;
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
                    {/* Dev/debug-only rows: unpublished reciters need testing before
                    release, so flag them (hardcoded — never user-facing). */}
                    {!rec.published ? (
                      <HStack
                        alignItems="center"
                        gap="$1"
                        paddingHorizontal="$2"
                        paddingVertical="$0.5"
                        borderRadius="$2"
                        backgroundColor="$backgroundSecondary">
                        <Icon as={FlaskConical} size="xs" color="$warning" />
                        <Text size="xs" fontWeight="600" color="$warning">
                          Unpublished
                        </Text>
                      </HStack>
                    ) : null}
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

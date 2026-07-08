import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { keyboardFilter } from "miftah";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { ListenSearchBar } from "@/components/quran/listen/ListenSearchBar";
import { SurahListRow } from "@/components/quran/listen/SurahListRow";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import { SURAH_NAMES, SURAH_NAMES_LATIN } from "@/constants/Quran";
import type { SurahMeta } from "@/types/quran";

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

// Match a query against the surah's Latin transliteration, Arabic name, and
// number. miftah also covers Arabic-keyboard mistypes and phonetic input, so
// "baqarah", "البقرة", the mis-layout equivalent, and "2" all find Al-Baqarah.
const matchesQuery = (surah: number, q: string): boolean =>
  keyboardFilter(SURAH_NAMES_LATIN[surah], q) ||
  keyboardFilter(SURAH_NAMES[surah], q) ||
  keyboardFilter(String(surah), q);

const QuranListenSurahsScreen = () => {
  const { t, i18n } = useTranslation();
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const playerState = useQuranAudioStore((s) => s.playerState);
  const selectedRecitationId = useQuranAudioStore((s) => s.selectedRecitationId);
  const [metaBySurah, setMetaBySurah] = useState<Record<number, SurahMeta>>({});
  const [reciterName, setReciterName] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Warm the CDN connection and load per-surah metadata in a single query.
    void quranAudioPlayer.warmUp();
    QuranContentDB.getAllSurahs().then((all) => {
      const map: Record<number, SurahMeta> = {};
      for (const m of all) map[m.number] = m;
      setMetaBySurah(map);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    quranReciterRegistry.reciterOf(selectedRecitationId).then((r) => {
      if (alive && r) setReciterName(quranReciterRegistry.localizedName(r, i18n.language));
    });
    return () => {
      alive = false;
    };
  }, [selectedRecitationId, i18n.language]);

  const onPress = useCallback((surah: number) => {
    quranAudioPlayer.playSurah(surah);
  }, []);

  const data = useMemo(
    () => (query.trim() === "" ? SURAHS : SURAHS.filter((n) => matchesQuery(n, query))),
    [query]
  );

  return (
    <Background>
      <TopBar title={reciterName ?? "tools.quranListen.title"} href="/quran-listen" backOnClick />
      <VStack paddingHorizontal="$3" paddingTop="$2">
        <ListenSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t("quran.listen.searchSurah")}
        />
      </VStack>
      <FlatList
        data={data}
        keyExtractor={(surah) => String(surah)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        extraData={`${currentSurah}:${playerState}:${Object.keys(metaBySurah).length}`}
        ListEmptyComponent={
          <Text color="$typographySecondary" textAlign="center" paddingVertical="$6">
            {t("quran.listen.noResults")}
          </Text>
        }
        renderItem={({ item: surah }) => (
          <SurahListRow
            surah={surah}
            meta={metaBySurah[surah]}
            isCurrent={currentSurah === surah}
            isLoading={playerState === QURAN_PLAYER_STATE.LOADING && currentSurah === surah}
            onPress={onPress}
          />
        )}
      />
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenSurahsScreen;

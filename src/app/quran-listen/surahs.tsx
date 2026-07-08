import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { keyboardFilter } from "miftah";
import { DownloadCloud } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { ListenSearchBar } from "@/components/quran/listen/ListenSearchBar";
import { SurahListRow } from "@/components/quran/listen/SurahListRow";
import { DownloadsDrawer } from "@/components/quran/listen/DownloadsDrawer";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranAudioStore } from "@/stores/quranAudio";
import {
  useQuranDownloadStore,
  surahsForReciter,
  progressForReciter,
} from "@/stores/quranDownload";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranRecitation } from "@/types/quran-audio";
import { SURAH_NAMES, SURAH_NAMES_LATIN } from "@/constants/Quran";
import { buildSurahSizeResolver } from "@/utils/quranAudioSize";
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
  const [recitation, setRecitation] = useState<QuranRecitation | null>(null);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const downloaded = useQuranDownloadStore((s) => s.downloaded);
  const downloading = useQuranDownloadStore((s) => s.downloading);
  const progress = useQuranDownloadStore((s) => s.progress);
  const resumeStates = useQuranDownloadStore((s) => s.resumeStates);
  const refresh = useQuranDownloadStore((s) => s.refresh);
  const downloadOne = useQuranDownloadStore((s) => s.downloadOne);
  const pauseOne = useQuranDownloadStore((s) => s.pauseOne);
  const deleteOne = useQuranDownloadStore((s) => s.deleteOne);

  // This reciter's in-flight surahs + per-surah progress, sliced from the
  // composite-keyed store state.
  const downloadingSet = useMemo(
    () => new Set(surahsForReciter(downloading, selectedRecitationId)),
    [downloading, selectedRecitationId]
  );
  const progressBySurah = useMemo(
    () => progressForReciter(progress, selectedRecitationId),
    [progress, selectedRecitationId]
  );

  // Surahs with a saved resume point but no longer in flight = paused.
  const pausedSet = useMemo(() => {
    const prefix = `${selectedRecitationId}:`;
    const out = new Set<number>();
    for (const k of Object.keys(resumeStates)) {
      if (k.startsWith(prefix)) {
        const n = Number(k.slice(prefix.length));
        if (!downloadingSet.has(n)) out.add(n);
      }
    }
    return out;
  }, [resumeStates, selectedRecitationId, downloadingSet]);

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
    quranReciterRegistry.getRecitationById(selectedRecitationId).then((rec) => {
      if (!alive || !rec) return;
      setRecitation(rec);
      refresh(rec);
    });
    return () => {
      alive = false;
    };
  }, [selectedRecitationId, i18n.language, refresh]);

  const onPress = useCallback((surah: number) => {
    quranAudioPlayer.playSurah(surah);
  }, []);
  const onDownload = useCallback(
    (surah: number) => {
      if (recitation) void downloadOne(recitation, surah);
    },
    [recitation, downloadOne]
  );
  const onPause = useCallback(
    (surah: number) => {
      if (recitation) pauseOne(recitation, surah);
    },
    [recitation, pauseOne]
  );
  const onDelete = useCallback(
    (surah: number) => {
      if (recitation) deleteOne(recitation, surah);
    },
    [recitation, deleteOne]
  );

  const data = useMemo(
    () => (query.trim() === "" ? SURAHS : SURAHS.filter((n) => matchesQuery(n, query))),
    [query]
  );

  // Per-surah download size (exact from the manifest, else estimated).
  const { sizeOf, exact: sizeExact } = useMemo(
    () => buildSurahSizeResolver(metaBySurah, recitation),
    [metaBySurah, recitation]
  );

  return (
    <Background>
      <TopBar
        title={reciterName ?? "tools.quranListen.title"}
        href="/quran-listen"
        backOnClick
        icon={DownloadCloud}
        rightIconLabel={t("quran.listen.manageDownloads")}
        onRightPress={() => setDrawerOpen(true)}
      />
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
        extraData={`${currentSurah}:${playerState}:${downloaded.join()}:${[...downloadingSet].join()}:${[...pausedSet].join()}:${Object.keys(
          progressBySurah
        )
          .map((n) => `${n}=${Math.round((progressBySurah[Number(n)] ?? 0) * 100)}`)
          .join()}:${Object.keys(metaBySurah).length}`}
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
            isDownloaded={downloaded.includes(surah)}
            isDownloading={downloadingSet.has(surah)}
            isPaused={pausedSet.has(surah)}
            downloadProgress={progressBySurah[surah]}
            estimatedBytes={sizeOf(surah)}
            sizeApprox={!sizeExact}
            onPress={onPress}
            onDownload={onDownload}
            onPause={onPause}
            onDelete={onDelete}
          />
        )}
      />
      <QuranMiniPlayer />

      <DownloadsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        recitation={recitation}
        sizeOf={sizeOf}
        sizeApprox={!sizeExact}
      />
    </Background>
  );
};

export default QuranListenSurahsScreen;

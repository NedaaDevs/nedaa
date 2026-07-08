import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { keyboardFilter } from "miftah";
import { DownloadCloud, Trash2 } from "lucide-react-native";

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
import { SurahListRow } from "@/components/quran/listen/SurahListRow";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { useQuranDownloadStore } from "@/stores/quranDownload";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranRecitation } from "@/types/quran-audio";
import { SURAH_NAMES, SURAH_NAMES_LATIN } from "@/constants/Quran";
import { formatFileSize } from "@/utils/customSoundManager";
import { formatNumberToLocale } from "@/utils/number";
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

  const downloaded = useQuranDownloadStore((s) => s.downloaded);
  const downloading = useQuranDownloadStore((s) => s.downloading);
  const allActive = useQuranDownloadStore((s) => s.allActive);
  const allDone = useQuranDownloadStore((s) => s.allDone);
  const allTotal = useQuranDownloadStore((s) => s.allTotal);
  const bytes = useQuranDownloadStore((s) => s.bytes);
  const refresh = useQuranDownloadStore((s) => s.refresh);
  const downloadOne = useQuranDownloadStore((s) => s.downloadOne);
  const deleteOne = useQuranDownloadStore((s) => s.deleteOne);
  const downloadAll = useQuranDownloadStore((s) => s.downloadAll);
  const cancelAll = useQuranDownloadStore((s) => s.cancelAll);
  const deleteAll = useQuranDownloadStore((s) => s.deleteAll);

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
  const onDelete = useCallback(
    (surah: number) => {
      if (recitation) deleteOne(recitation, surah);
    },
    [recitation, deleteOne]
  );

  const confirmDeleteAll = () => {
    if (!recitation) return;
    Alert.alert(t("quran.listen.deleteAllTitle"), t("quran.listen.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("quran.listen.deleteAll"),
        style: "destructive",
        onPress: () => deleteAll(recitation),
      },
    ]);
  };

  const data = useMemo(
    () => (query.trim() === "" ? SURAHS : SURAHS.filter((n) => matchesQuery(n, query))),
    [query]
  );
  const allDownloaded = downloaded.length >= SURAHS.length;

  return (
    <Background>
      <TopBar title={reciterName ?? "tools.quranListen.title"} href="/quran-listen" backOnClick />
      <VStack paddingHorizontal="$3" paddingTop="$2" gap="$2">
        <ListenSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t("quran.listen.searchSurah")}
        />
        {recitation ? (
          <HStack alignItems="center" justifyContent="space-between" paddingHorizontal="$1">
            {allActive ? (
              <Pressable
                onPress={cancelAll}
                flexDirection="row"
                alignItems="center"
                gap="$2"
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}>
                <Spinner size="small" color="$accentPrimary" />
                <Text size="xs" color="$typographySecondary">
                  {t("quran.listen.downloadingCount", {
                    done: formatNumberToLocale(String(allDone)),
                    total: formatNumberToLocale(String(allTotal)),
                  })}
                </Text>
                <Text size="xs" color="$accentPrimary" fontWeight="600">
                  {t("common.cancel")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => downloadAll(recitation, SURAHS)}
                disabled={allDownloaded}
                opacity={allDownloaded ? 0.4 : 1}
                flexDirection="row"
                alignItems="center"
                gap="$2"
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.downloadAll")}>
                <Icon as={DownloadCloud} size="sm" color="$accentPrimary" />
                <Text size="xs" color="$accentPrimary" fontWeight="600">
                  {t("quran.listen.downloadAll")}
                </Text>
              </Pressable>
            )}
            {downloaded.length > 0 && !allActive ? (
              <Pressable
                onPress={confirmDeleteAll}
                flexDirection="row"
                alignItems="center"
                gap="$2"
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.deleteAll")}>
                <Text size="xs" color="$typographySecondary">
                  {formatFileSize(bytes)}
                </Text>
                <Icon as={Trash2} size="sm" color="$typographySecondary" />
              </Pressable>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
      <FlatList
        data={data}
        keyExtractor={(surah) => String(surah)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        extraData={`${currentSurah}:${playerState}:${downloaded.join()}:${downloading.join()}:${Object.keys(metaBySurah).length}`}
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
            isDownloading={downloading.includes(surah)}
            onPress={onPress}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        )}
      />
      <QuranMiniPlayer />
    </Background>
  );
};

export default QuranListenSurahsScreen;

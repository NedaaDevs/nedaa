import { useCallback, useEffect, useState } from "react";
import { FlatList } from "react-native";

import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";
import { SurahListRow } from "@/components/quran/listen/SurahListRow";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { SurahMeta } from "@/types/quran";

const SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

const QuranListenSurahsScreen = () => {
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const playerState = useQuranAudioStore((s) => s.playerState);
  const [metaBySurah, setMetaBySurah] = useState<Record<number, SurahMeta>>({});

  useEffect(() => {
    // Warm the CDN connection so the first surah tap starts fast, and load the
    // per-surah metadata (ayah count, revelation place) in a single query.
    void quranAudioPlayer.warmUp();
    QuranContentDB.getAllSurahs().then((all) => {
      const map: Record<number, SurahMeta> = {};
      for (const m of all) map[m.number] = m;
      setMetaBySurah(map);
    });
  }, []);

  const onPress = useCallback((surah: number) => {
    quranAudioPlayer.playSurah(surah);
  }, []);

  return (
    <Background>
      <TopBar title="tools.quranListen.title" href="/quran-listen" backOnClick />
      <FlatList
        data={SURAHS}
        keyExtractor={(surah) => String(surah)}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        extraData={`${currentSurah}:${playerState}:${Object.keys(metaBySurah).length}`}
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

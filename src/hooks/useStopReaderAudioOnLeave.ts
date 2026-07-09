import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

import { useQuranAudioStore } from "@/stores/quranAudio";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { QURAN_QUEUE_KIND, QURAN_PLAYER_STATE } from "@/types/quran-audio";

// The reader's per-ayah playback is a companion to on-screen reading, so it must
// not outlive the reader: stop it when the reader loses focus or the app is
// backgrounded. Guarded to the AYAH queue so it never touches Listen playback —
// Listen (gapless, SURAH queue) is the surface that keeps playing in the background.
const stopIfReaderPlaying = () => {
  const s = useQuranAudioStore.getState();
  if (s.playerState !== QURAN_PLAYER_STATE.IDLE && s.queue?.kind === QURAN_QUEUE_KIND.AYAH) {
    void quranAudioPlayer.stop();
  }
};

export const useStopReaderAudioOnLeave = () => {
  // Navigating away from the reader (cleanup runs on blur).
  useFocusEffect(useCallback(() => stopIfReaderPlaying, []));

  // Backgrounding the app — the reader must not keep playing behind the scenes.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") stopIfReaderPlaying();
    });
    return () => sub.remove();
  }, []);
};

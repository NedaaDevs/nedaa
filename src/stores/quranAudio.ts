import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  QURAN_PLAYER_STATE,
  QURAN_LISTEN_MODE,
  type QuranPlayerState,
  type QuranListenMode,
  type QuranQueueDescriptor,
} from "@/types/quran-audio";

type QuranAudioState = {
  selectedRecitationId: string; // holds a recitation id, e.g. "minshawi-murattal"
  listenMode: QuranListenMode;
  playerState: QuranPlayerState;
  currentSurah: number | null;
  currentAyah: number | null;
  queue: QuranQueueDescriptor | null;
  following: boolean;
  position: number;
  duration: number;

  setSelectedRecitation: (id: string) => void;
  setListenMode: (mode: QuranListenMode) => void;
  setPlayerState: (state: QuranPlayerState) => void;
  setCurrentAyah: (surah: number, ayah: number) => void;
  setQueue: (queue: QuranQueueDescriptor | null) => void;
  setFollowing: (on: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  resetPlayback: () => void;
};

export const useQuranAudioStore = create<QuranAudioState>()(
  persist(
    (set) => ({
      selectedRecitationId: "minshawi-murattal",
      listenMode: QURAN_LISTEN_MODE.STOP,
      playerState: QURAN_PLAYER_STATE.IDLE,
      currentSurah: null,
      currentAyah: null,
      queue: null,
      following: true,
      position: 0,
      duration: 0,

      setSelectedRecitation: (selectedRecitationId) => set({ selectedRecitationId }),
      setListenMode: (listenMode) => set({ listenMode }),
      setPlayerState: (playerState) => set({ playerState }),
      setCurrentAyah: (currentSurah, currentAyah) => set({ currentSurah, currentAyah }),
      setQueue: (queue) => set({ queue }),
      setFollowing: (following) => set({ following }),
      setPosition: (position) => set({ position }),
      setDuration: (duration) => set({ duration }),
      resetPlayback: () =>
        set({
          playerState: QURAN_PLAYER_STATE.IDLE,
          currentSurah: null,
          currentAyah: null,
          queue: null,
          following: true,
          position: 0,
          duration: 0,
        }),
    }),
    {
      name: "quran-audio-storage",
      storage: createJSONStorage(() => Storage),
      // Only preferences persist; transient playback state never does.
      partialize: (state) => ({
        selectedRecitationId: state.selectedRecitationId,
        listenMode: state.listenMode,
      }),
    }
  )
);

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
  // Reader (ayah) and Listen (gapless) keep separate selections so a Listen pick
  // can't bind a gapless recitation to the reader — which needs per-ayah/word.
  readerRecitationId: string;
  listenRecitationId: string;
  listenMode: QuranListenMode;
  playerState: QuranPlayerState;
  currentSurah: number | null;
  currentAyah: number | null;
  queue: QuranQueueDescriptor | null;
  following: boolean;
  position: number;
  duration: number;
  // Wall-clock (epoch ms) of the last position update, so the UI can interpolate
  // smoothly between nitro's coarse progress ticks.
  positionUpdatedAt: number;
  // Sleep timer: a deadline (epoch ms) + the chosen duration for the duration
  // timer, or a flag to stop when the current surah ends. All null/false when off.
  sleepTimerEndsAt: number | null;
  sleepTimerMinutes: number | null;
  sleepTimerSurahEnd: boolean;

  setReaderRecitation: (id: string) => void;
  setListenRecitation: (id: string) => void;
  setListenMode: (mode: QuranListenMode) => void;
  setPlayerState: (state: QuranPlayerState) => void;
  setCurrentAyah: (surah: number, ayah: number) => void;
  setQueue: (queue: QuranQueueDescriptor | null) => void;
  setFollowing: (on: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setProgress: (position: number, duration: number, updatedAt: number) => void;
  setSleepTimer: (endsAt: number | null, minutes: number | null, surahEnd: boolean) => void;
  resetPlayback: () => void;
};

export const useQuranAudioStore = create<QuranAudioState>()(
  persist(
    (set) => ({
      readerRecitationId: "minshawi-murattal",
      listenRecitationId: "minshawi-murattal",
      listenMode: QURAN_LISTEN_MODE.STOP,
      playerState: QURAN_PLAYER_STATE.IDLE,
      currentSurah: null,
      currentAyah: null,
      queue: null,
      following: true,
      position: 0,
      duration: 0,
      positionUpdatedAt: 0,
      sleepTimerEndsAt: null,
      sleepTimerMinutes: null,
      sleepTimerSurahEnd: false,

      setReaderRecitation: (readerRecitationId) => set({ readerRecitationId }),
      setListenRecitation: (listenRecitationId) => set({ listenRecitationId }),
      setListenMode: (listenMode) => set({ listenMode }),
      setPlayerState: (playerState) => set({ playerState }),
      setCurrentAyah: (currentSurah, currentAyah) => set({ currentSurah, currentAyah }),
      setQueue: (queue) => set({ queue }),
      setFollowing: (following) => set({ following }),
      setPosition: (position) => set({ position }),
      setDuration: (duration) => set({ duration }),
      setProgress: (position, duration, positionUpdatedAt) =>
        set({ position, duration, positionUpdatedAt }),
      setSleepTimer: (sleepTimerEndsAt, sleepTimerMinutes, sleepTimerSurahEnd) =>
        set({ sleepTimerEndsAt, sleepTimerMinutes, sleepTimerSurahEnd }),
      resetPlayback: () =>
        set({
          playerState: QURAN_PLAYER_STATE.IDLE,
          currentSurah: null,
          currentAyah: null,
          queue: null,
          following: true,
          position: 0,
          duration: 0,
          positionUpdatedAt: 0,
          sleepTimerEndsAt: null,
          sleepTimerMinutes: null,
          sleepTimerSurahEnd: false,
        }),
    }),
    {
      name: "quran-audio-storage",
      storage: createJSONStorage(() => Storage),
      // Only preferences persist; transient playback state never does.
      partialize: (state) => ({
        readerRecitationId: state.readerRecitationId,
        listenRecitationId: state.listenRecitationId,
        listenMode: state.listenMode,
      }),
    }
  )
);

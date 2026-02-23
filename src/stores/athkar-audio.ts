import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

import { PLAYBACK_MODE } from "@/constants/AthkarAudio";

import type {
  AthkarAudioState,
  AthkarAudioActions,
  PlaybackMode,
  RepeatLimit,
  DownloadStatus,
} from "@/types/athkar-audio";

type AthkarAudioStore = AthkarAudioState & AthkarAudioActions;

const initialPlaybackState: Pick<AthkarAudioState, "position" | "duration" | "showBottomSheet"> = {
  position: 0,
  duration: 0,
  showBottomSheet: false,
};

export const useAthkarAudioStore = create<AthkarAudioStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Persisted settings
        playbackMode: PLAYBACK_MODE.OFF as PlaybackMode,
        selectedReciterId: null,
        repeatLimit: "all" as RepeatLimit,
        comfortMode: false,
        onboardingCompleted: false,

        // Runtime playback state
        ...initialPlaybackState,

        // Runtime download state
        downloads: {},
        downloadProgress: {},
        totalStorageUsed: 0,

        // --- State setters ---
        setPosition: (position: number) => set({ position }),
        setDuration: (duration: number) => set({ duration }),
        setShowBottomSheet: (show: boolean) => set({ showBottomSheet: show }),

        // --- Settings actions ---
        setPlaybackMode: (mode: PlaybackMode) => set({ playbackMode: mode }),

        selectReciter: (id: string) => {
          set({ selectedReciterId: id, ...initialPlaybackState });
        },

        setRepeatLimit: (limit: RepeatLimit) => set({ repeatLimit: limit }),
        toggleComfortMode: () => set((state) => ({ comfortMode: !state.comfortMode })),
        setOnboardingCompleted: (completed: boolean) => set({ onboardingCompleted: completed }),

        // --- Download actions ---
        setDownloadStatus: (thikrId: string, status: DownloadStatus) =>
          set((state) => ({
            downloads: { ...state.downloads, [thikrId]: status },
          })),

        setDownloadProgress: (thikrId: string, progress: number) =>
          set((state) => ({
            downloadProgress: { ...state.downloadProgress, [thikrId]: progress },
          })),

        setTotalStorageUsed: (bytes: number) => set({ totalStorageUsed: bytes }),

        clearDownloads: () => set({ downloads: {}, downloadProgress: {} }),
      }),
      {
        name: "athkar-audio-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          playbackMode: state.playbackMode,
          selectedReciterId: state.selectedReciterId,
          repeatLimit: state.repeatLimit,
          comfortMode: state.comfortMode,
          onboardingCompleted: state.onboardingCompleted,
        }),
      }
    ),
    { name: "athkar-audio-store" }
  )
);

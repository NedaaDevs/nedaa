import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

import { PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { athkarPlayer } from "@/services/athkar-player";

import type {
  AthkarAudioState,
  AthkarAudioActions,
  PlaybackMode,
  PlayerState,
  RepeatLimit,
  DownloadStatus,
} from "@/types/athkar-audio";

type AthkarAudioStore = AthkarAudioState & AthkarAudioActions;

const initialPlaybackState: Pick<
  AthkarAudioState,
  | "playerState"
  | "currentThikrId"
  | "currentRepeat"
  | "totalRepeats"
  | "sessionProgress"
  | "audioDuration"
  | "audioPosition"
> = {
  playerState: "idle",
  currentThikrId: null,
  currentRepeat: 0,
  totalRepeats: 0,
  sessionProgress: { current: 0, total: 0 },
  audioDuration: 0,
  audioPosition: 0,
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
        audioControlsExpanded: true,

        // Runtime playback state
        ...initialPlaybackState,

        // Runtime download state
        downloads: {},
        downloadProgress: {},
        totalStorageUsed: 0,

        // --- Playback actions (proxy to engine) ---
        play: () => athkarPlayer.play(),
        pause: () => athkarPlayer.pause(),
        resume: () => athkarPlayer.resume(),
        next: () => athkarPlayer.next(),
        previous: () => athkarPlayer.previous(),
        seekTo: (seconds: number) => athkarPlayer.seekTo(seconds),
        stop: () => {
          athkarPlayer.stop();
          set(initialPlaybackState);
        },
        dismiss: () => {
          athkarPlayer.dismiss();
          set({ playerState: "idle" });
        },

        // --- State setters (called by bridge) ---
        setPlayerState: (state: PlayerState) => set({ playerState: state }),
        setCurrentThikrId: (id: string | null) => set({ currentThikrId: id }),
        setCurrentRepeat: (repeat: number) => set({ currentRepeat: repeat }),
        setTotalRepeats: (total: number) => set({ totalRepeats: total }),
        setSessionProgress: (progress: { current: number; total: number }) =>
          set({ sessionProgress: progress }),
        setAudioDuration: (duration: number) => set({ audioDuration: duration }),
        setAudioPosition: (position: number) => set({ audioPosition: position }),

        // --- Settings actions ---
        setPlaybackMode: (mode: PlaybackMode) => {
          set({ playbackMode: mode });
          athkarPlayer.setMode(mode);
        },

        selectReciter: (id: string) => {
          const { playerState } = get();
          if (playerState !== "idle") {
            athkarPlayer.stop();
            set(initialPlaybackState);
          }
          set({ selectedReciterId: id });
        },

        setRepeatLimit: (limit: RepeatLimit) => {
          set({ repeatLimit: limit });
          athkarPlayer.setRepeatLimit(limit);
        },

        toggleComfortMode: () => set((state) => ({ comfortMode: !state.comfortMode })),

        setOnboardingCompleted: (completed: boolean) => set({ onboardingCompleted: completed }),

        setAudioControlsExpanded: (expanded: boolean) => set({ audioControlsExpanded: expanded }),

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

        // --- Reset ---
        resetPlaybackState: () => set(initialPlaybackState),
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
          audioControlsExpanded: state.audioControlsExpanded,
        }),
      }
    ),
    { name: "athkar-audio-store" }
  )
);

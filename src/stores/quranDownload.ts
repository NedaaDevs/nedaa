import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import type { DownloadPauseState } from "expo-file-system";

import { quranAudioDownload } from "@/services/quran-audio/quranAudioDownload";
import { QuranManifestService } from "@/services/quran-manifest";
import { AppLogger } from "@/utils/appLogger";
import type { QuranRecitation } from "@/types/quran-audio";

const log = AppLogger.create("quran-download");

const key = (recitationId: string, surah: number): string => `${recitationId}:${surah}`;

type QuranDownloadState = {
  // The reciter whose download state is loaded (the filesystem is the source of
  // truth; this store caches it for reactive UI).
  recitationId: string | null;
  downloaded: number[]; // surah numbers saved
  downloading: number[]; // surah numbers in flight
  bytes: number; // total bytes used by this reciter's surahs
  allActive: boolean; // a "download all" run is in progress
  allDone: number;
  allTotal: number;
  progress: Record<number, number>; // 0..1 per surah being downloaded
  // Persisted so an interrupted transfer resumes from its byte offset (like the
  // mushaf image download) instead of restarting.
  resumeStates: Record<string, DownloadPauseState>;

  refresh: (recitation: QuranRecitation) => void;
  downloadOne: (recitation: QuranRecitation, surah: number) => Promise<void>;
  pauseOne: (recitation: QuranRecitation, surah: number) => void;
  deleteOne: (recitation: QuranRecitation, surah: number) => void;
  downloadAll: (recitation: QuranRecitation, surahs: number[]) => Promise<void>;
  cancelAll: () => void;
  deleteAll: (recitation: QuranRecitation) => void;
};

export const useQuranDownloadStore = create<QuranDownloadState>()(
  persist(
    (set, get) => {
      // Run one surah download, threading and updating its persisted resume state.
      const runOne = async (recitation: QuranRecitation, surah: number, baseUrl: string) => {
        const k = key(recitation.id, surah);
        const { done, resume } = await quranAudioDownload.downloadSurahFile(
          recitation,
          surah,
          baseUrl,
          get().resumeStates[k],
          (frac) => set((s) => ({ progress: { ...s.progress, [surah]: frac } }))
        );
        set((s) => {
          const resumeStates = { ...s.resumeStates };
          if (done || !resume) delete resumeStates[k];
          else resumeStates[k] = resume;
          const progress = { ...s.progress };
          delete progress[surah];
          return {
            downloading: s.downloading.filter((n) => n !== surah),
            downloaded: done ? Array.from(new Set([...s.downloaded, surah])) : s.downloaded,
            resumeStates,
            progress,
            bytes: quranAudioDownload.surahStorageBytes(recitation.id, recitation.fileFormat),
          };
        });
        return done;
      };

      return {
        recitationId: null,
        downloaded: [],
        downloading: [],
        bytes: 0,
        allActive: false,
        allDone: 0,
        allTotal: 0,
        progress: {},
        resumeStates: {},

        refresh: (recitation) => {
          set({
            recitationId: recitation.id,
            downloaded: quranAudioDownload.downloadedSurahs(recitation.id, recitation.fileFormat),
            bytes: quranAudioDownload.surahStorageBytes(recitation.id, recitation.fileFormat),
          });
        },

        downloadOne: async (recitation, surah) => {
          if (get().downloading.includes(surah) || get().downloaded.includes(surah)) return;
          // Mark in-flight synchronously, before the manifest await, so a second
          // rapid tap is rejected by the guard above (no duplicate download).
          set((s) => ({ downloading: [...s.downloading, surah] }));
          const manifest = await QuranManifestService.fetchManifest();
          if (!manifest) {
            set((s) => ({ downloading: s.downloading.filter((n) => n !== surah) }));
            return;
          }
          await runOne(recitation, surah, manifest.baseUrl);
        },

        pauseOne: (recitation, surah) => {
          quranAudioDownload.pauseSurahDownload(recitation.id, surah);
        },

        deleteOne: (recitation, surah) => {
          quranAudioDownload.deleteSurahFile(recitation.id, surah, recitation.fileFormat);
          set((s) => {
            const resumeStates = { ...s.resumeStates };
            delete resumeStates[key(recitation.id, surah)];
            return {
              downloaded: s.downloaded.filter((n) => n !== surah),
              resumeStates,
              bytes: quranAudioDownload.surahStorageBytes(recitation.id, recitation.fileFormat),
            };
          });
        },

        downloadAll: async (recitation, surahs) => {
          const manifest = await QuranManifestService.fetchManifest();
          if (!manifest) return;
          const pending = surahs.filter((n) => !get().downloaded.includes(n));
          set({ allActive: true, allDone: 0, allTotal: pending.length });
          log.i("Download", `download-all ${pending.length} surahs for ${recitation.id}`);
          for (const n of pending) {
            if (!get().allActive) break; // cancelled
            set((s) => ({ downloading: [...s.downloading, n] }));
            const done = await runOne(recitation, n, manifest.baseUrl);
            set((s) => ({ allDone: s.allDone + 1 }));
            if (!done) break; // interrupted — resume state saved; retry continues here
          }
          set({ allActive: false });
        },

        cancelAll: () => {
          const { recitationId, downloading } = get();
          set({ allActive: false });
          // Pause in-flight downloads so their partial files + resume states persist.
          if (recitationId) {
            for (const n of downloading) quranAudioDownload.pauseSurahDownload(recitationId, n);
          }
        },

        deleteAll: (recitation) => {
          quranAudioDownload.deleteAllSurahs(recitation.id, recitation.fileFormat);
          set((s) => {
            const resumeStates = { ...s.resumeStates };
            for (const k of Object.keys(resumeStates)) {
              if (k.startsWith(`${recitation.id}:`)) delete resumeStates[k];
            }
            return { downloaded: [], bytes: 0, resumeStates };
          });
        },
      };
    },
    {
      name: "quran-download-storage",
      storage: createJSONStorage(() => Storage),
      // Only the resume states persist; downloaded/bytes are re-read from disk.
      partialize: (s) => ({ resumeStates: s.resumeStates }),
    }
  )
);

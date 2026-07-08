import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import type { DownloadPauseState } from "expo-file-system";

import { quranAudioDownload } from "@/services/quran-audio/quranAudioDownload";
import { QuranManifestService } from "@/services/quran-manifest";
import { AppLogger } from "@/utils/appLogger";
import type { QuranRecitation } from "@/types/quran-audio";

const log = AppLogger.create("quran-download");

// All in-flight/resume state is keyed per reciter, because a download can outlive
// the screen that started it — the user may switch reciters mid-download, and the
// same surah number belongs to a different file for each reciter.
export const downloadKey = (recitationId: string, surah: number): string =>
  `${recitationId}:${surah}`;

// The surah numbers among `keys` (composite `recitationId:surah`) for one reciter.
export const surahsForReciter = (keys: string[], recitationId: string | null): number[] => {
  if (!recitationId) return [];
  const prefix = `${recitationId}:`;
  return keys.filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length)));
};

// The per-surah progress fractions for one reciter, re-keyed by surah number.
export const progressForReciter = (
  progress: Record<string, number>,
  recitationId: string | null
): Record<number, number> => {
  const out: Record<number, number> = {};
  if (!recitationId) return out;
  const prefix = `${recitationId}:`;
  for (const k of Object.keys(progress)) {
    if (k.startsWith(prefix)) out[Number(k.slice(prefix.length))] = progress[k];
  }
  return out;
};

type QuranDownloadState = {
  // The reciter currently DISPLAYED (filesystem is the source of truth for its
  // `downloaded`/`bytes`; this store caches them for reactive UI).
  recitationId: string | null;
  downloaded: number[]; // surah numbers saved for the displayed reciter
  downloading: string[]; // composite keys in flight, across ALL reciters
  bytes: number; // bytes used by the displayed reciter
  allActive: boolean; // a "download all" run is in progress
  allDone: number;
  allTotal: number;
  progress: Record<string, number>; // composite key -> 0..1
  // Persisted so an interrupted transfer resumes from its byte offset instead of
  // restarting (like the mushaf image download).
  resumeStates: Record<string, DownloadPauseState>;
  // Composite keys deleted/paused before their task finished — their runOne must
  // discard results instead of saving them.
  aborted: Record<string, true>;

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
      const storageBytes = (recitation: QuranRecitation): number =>
        quranAudioDownload.surahStorageBytes(recitation.id, recitation.fileFormat);

      // Run one surah download, threading its persisted resume state. Results are
      // written back only into the displayed reciter's slice, and discarded if the
      // download was aborted (deleted/paused) while in flight.
      const runOne = async (recitation: QuranRecitation, surah: number, baseUrl: string) => {
        const k = downloadKey(recitation.id, surah);

        // Paused/deleted during the pre-task window (before a task existed) — bail.
        if (get().aborted[k]) {
          set((s) => {
            const aborted = { ...s.aborted };
            delete aborted[k];
            return { aborted, downloading: s.downloading.filter((x) => x !== k) };
          });
          return false;
        }

        const { done, resume } = await quranAudioDownload.downloadSurahFile(
          recitation,
          surah,
          baseUrl,
          get().resumeStates[k],
          (frac) => {
            if (!get().aborted[k]) set((s) => ({ progress: { ...s.progress, [k]: frac } }));
          }
        );

        const wasAborted = !!get().aborted[k];
        set((s) => {
          const resumeStates = { ...s.resumeStates };
          if (wasAborted || done || !resume) delete resumeStates[k];
          else resumeStates[k] = resume;
          const progress = { ...s.progress };
          delete progress[k];
          const aborted = { ...s.aborted };
          delete aborted[k];
          const isCurrent = s.recitationId === recitation.id;
          return {
            downloading: s.downloading.filter((x) => x !== k),
            progress,
            resumeStates,
            aborted,
            downloaded:
              isCurrent && done && !wasAborted
                ? Array.from(new Set([...s.downloaded, surah]))
                : s.downloaded,
            bytes: isCurrent ? storageBytes(recitation) : s.bytes,
          };
        });

        // Aborted while in flight — remove whatever the task left on disk.
        if (wasAborted) {
          quranAudioDownload.deleteSurahFile(recitation.id, surah, recitation.fileFormat);
          if (get().recitationId === recitation.id) set({ bytes: storageBytes(recitation) });
          return false;
        }
        return done;
      };

      const markInFlight = (k: string) =>
        set((s) => {
          const aborted = { ...s.aborted };
          delete aborted[k]; // a fresh start clears any stale abort flag
          return { downloading: [...s.downloading, k], aborted };
        });

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
        aborted: {},

        refresh: (recitation) => {
          set({
            recitationId: recitation.id,
            downloaded: quranAudioDownload.downloadedSurahs(recitation.id, recitation.fileFormat),
            bytes: storageBytes(recitation),
          });
        },

        downloadOne: async (recitation, surah) => {
          const k = downloadKey(recitation.id, surah);
          if (get().downloading.includes(k)) return;
          if (get().recitationId === recitation.id && get().downloaded.includes(surah)) return;
          // Mark in-flight synchronously, before the manifest await, so a second
          // rapid tap is rejected by the guard above (no duplicate download).
          markInFlight(k);
          const manifest = await QuranManifestService.fetchManifest();
          if (!manifest) {
            set((s) => ({ downloading: s.downloading.filter((x) => x !== k) }));
            return;
          }
          await runOne(recitation, surah, manifest.baseUrl);
        },

        pauseOne: (recitation, surah) => {
          const k = downloadKey(recitation.id, surah);
          const paused = quranAudioDownload.pauseSurahDownload(recitation.id, surah);
          if (!paused) {
            // No live task yet (still resolving the manifest) — flag it so runOne
            // bails when it starts, and drop it from the in-flight list now.
            set((s) => ({
              aborted: { ...s.aborted, [k]: true },
              downloading: s.downloading.filter((x) => x !== k),
            }));
          }
        },

        deleteOne: (recitation, surah) => {
          const k = downloadKey(recitation.id, surah);
          if (get().downloading.includes(k)) {
            // Cancel the live task; its runOne will clear the partial + state.
            quranAudioDownload.pauseSurahDownload(recitation.id, surah);
            set((s) => ({ aborted: { ...s.aborted, [k]: true } }));
          }
          quranAudioDownload.deleteSurahFile(recitation.id, surah, recitation.fileFormat);
          set((s) => {
            const resumeStates = { ...s.resumeStates };
            delete resumeStates[k];
            return {
              downloaded: s.downloaded.filter((n) => n !== surah),
              resumeStates,
              bytes: s.recitationId === recitation.id ? storageBytes(recitation) : s.bytes,
            };
          });
        },

        downloadAll: async (recitation, surahs) => {
          if (get().allActive) return; // re-entry guard (rapid double-tap)
          set({ allActive: true, allDone: 0, allTotal: 0 });
          const manifest = await QuranManifestService.fetchManifest();
          if (!manifest) {
            set({ allActive: false });
            return;
          }
          const isCurrent = get().recitationId === recitation.id;
          const pending = surahs.filter((n) => {
            const k = downloadKey(recitation.id, n);
            return !get().downloading.includes(k) && !(isCurrent && get().downloaded.includes(n));
          });
          set({ allTotal: pending.length });
          log.i("Download", `download-all ${pending.length} surahs for ${recitation.id}`);
          try {
            for (const n of pending) {
              if (!get().allActive) break; // cancelled
              markInFlight(downloadKey(recitation.id, n));
              // Skip past a paused/failed surah (its resume state is saved) rather
              // than aborting the whole batch.
              await runOne(recitation, n, manifest.baseUrl);
              set((s) => ({ allDone: s.allDone + 1 }));
            }
          } finally {
            set({ allActive: false }); // never leave the batch flag stuck on
          }
        },

        cancelAll: () => {
          set({ allActive: false });
          // Pause every in-flight download by its own reciter key (a download may
          // belong to a reciter no longer on screen).
          for (const k of get().downloading) {
            const sep = k.lastIndexOf(":");
            quranAudioDownload.pauseSurahDownload(k.slice(0, sep), Number(k.slice(sep + 1)));
          }
        },

        deleteAll: (recitation) => {
          const prefix = `${recitation.id}:`;
          // Abort any in-flight downloads for this reciter so they don't resurrect.
          for (const k of get().downloading) {
            if (k.startsWith(prefix)) {
              quranAudioDownload.pauseSurahDownload(recitation.id, Number(k.slice(prefix.length)));
            }
          }
          quranAudioDownload.deleteAllSurahs(recitation.id, recitation.fileFormat);
          set((s) => {
            const resumeStates = { ...s.resumeStates };
            const aborted = { ...s.aborted };
            for (const k of Object.keys(resumeStates))
              if (k.startsWith(prefix)) delete resumeStates[k];
            for (const k of s.downloading) if (k.startsWith(prefix)) aborted[k] = true;
            const isCurrent = s.recitationId === recitation.id;
            return {
              downloaded: isCurrent ? [] : s.downloaded,
              bytes: isCurrent ? 0 : s.bytes,
              resumeStates,
              aborted,
            };
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

import { File, Directory, Paths, DownloadTask } from "expo-file-system";
import type { DownloadPauseState, DownloadTaskOptions } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import type { QuranRecitation } from "@/types/quran-audio";
import { remoteSurahUrl } from "@/services/quran-audio/quranAudioUrl";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-download");
const ROOT = "quran-audio";

const recitationDir = (recitationId: string): Directory =>
  new Directory(Paths.document, ROOT, recitationId);

// Local filenames mirror the remote ones, so the extension must track the
// recitation's fileFormat (not every recitation is mp3).
const ayahFile = (recitationId: string, surah: number, ayah: number, fileFormat: string): File =>
  new File(recitationDir(recitationId), `${surah}_${ayah}.${fileFormat}`);

const getLocalPath = async (
  recitationId: string,
  surah: number,
  ayah: number,
  fileFormat: string
): Promise<string | null> => {
  const file = ayahFile(recitationId, surah, ayah, fileFormat);
  return file.exists ? file.uri : null;
};

const hasSurah = async (
  recitationId: string,
  surah: number,
  ayahCount: number,
  fileFormat: string
): Promise<boolean> => {
  for (let ayah = 1; ayah <= ayahCount; ayah++) {
    if (!ayahFile(recitationId, surah, ayah, fileFormat).exists) return false;
  }
  return true;
};

// The per-surah bundle URL: `${baseUrl}/${basePath}bundles/<surah>.zip`.
const surahBundleUrl = (baseUrl: string, recitation: QuranRecitation, surah: number): string =>
  `${baseUrl.replace(/\/+$/, "")}/${recitation.basePath.replace(/^\/+|\/+$/g, "")}/bundles/${surah}.zip`;

// Download one surah's ZIP bundle and extract it into the per-ayah files the
// player reads (<surah>_<ayah>.mp3). Idempotent: a fully-present surah is skipped.
const downloadSurah = async (
  recitation: QuranRecitation,
  surah: number,
  ayahCount: number,
  baseUrl: string
): Promise<void> => {
  if (await hasSurah(recitation.id, surah, ayahCount, recitation.fileFormat)) return;
  const dir = recitationDir(recitation.id);
  if (!dir.exists) dir.create({ intermediates: true });
  const zipFile = new File(dir, `${surah}.zip`);
  try {
    await File.downloadFileAsync(surahBundleUrl(baseUrl, recitation, surah), zipFile);
    await unzip(zipFile.uri, dir.uri); // extracts <surah>_<ayah>.mp3 into dir
  } catch (error) {
    log.w("Download", `surah ${surah} bundle failed: ${(error as Error)?.message}`);
    return;
  } finally {
    if (zipFile.exists) zipFile.delete();
  }
  log.i("Download", `surah ${surah} cached for ${recitation.id}`);
};

// ── Gapless (Listen) offline files ────────────────────────────────────────────
// One MP3 per surah at `<surah>.<fileFormat>`, distinct from the reader's
// per-ayah `<surah>_<ayah>` files, so both can share a recitation directory.

const surahFile = (recitationId: string, surah: number, fileFormat: string): File =>
  new File(recitationDir(recitationId), `${surah}.${fileFormat}`);

// Local uri if this surah is saved, else null (sync — .exists is a getter).
const getSurahFilePath = (
  recitationId: string,
  surah: number,
  fileFormat: string
): string | null => {
  const file = surahFile(recitationId, surah, fileFormat);
  return file.exists ? file.uri : null;
};

// In-flight tasks, keyed `${recitationId}:${surah}`, so a running download can be
// paused (which resolves its downloadAsync to null and yields a resumable state).
const activeTasks = new Map<string, DownloadTask>();
const taskKey = (recitationId: string, surah: number): string => `${recitationId}:${surah}`;

// Download one gapless surah file, resumable like the mushaf image download.
// `resume` is a previously-captured pause state; on interruption the returned
// `resume` lets a later call continue from the byte offset instead of restarting.
type SurahDownloadResult = { done: boolean; resume: DownloadPauseState | null };
const downloadSurahFile = async (
  recitation: QuranRecitation,
  surah: number,
  baseUrl: string,
  resume?: DownloadPauseState | null
): Promise<SurahDownloadResult> => {
  const file = surahFile(recitation.id, surah, recitation.fileFormat);
  if (file.exists) return { done: true, resume: null };
  const dir = recitationDir(recitation.id);
  if (!dir.exists) dir.create({ intermediates: true });
  const key = taskKey(recitation.id, surah);
  const options: DownloadTaskOptions = {};
  let task: DownloadTask | null = null;
  try {
    let result: File | null;
    if (resume) {
      try {
        task = DownloadTask.fromSavable(resume, options);
        activeTasks.set(key, task);
        result = await task.resumeAsync();
      } catch {
        // Stale resume state — restart fresh.
        task = new DownloadTask(remoteSurahUrl(baseUrl, recitation, surah), file, options);
        activeTasks.set(key, task);
        result = await task.downloadAsync();
      }
    } else {
      task = new DownloadTask(remoteSurahUrl(baseUrl, recitation, surah), file, options);
      activeTasks.set(key, task);
      result = await task.downloadAsync();
    }
    activeTasks.delete(key);
    if (result) {
      log.i("Download", `surah ${surah} saved for ${recitation.id}`);
      return { done: true, resume: null };
    }
    // Paused via pauseAsync — keep the partial file and hand back a resume state.
    let paused: DownloadPauseState | null = null;
    try {
      paused = task.savable();
    } catch {
      paused = null;
    }
    log.i("Download", `surah ${surah} paused for ${recitation.id}`);
    return { done: false, resume: paused };
  } catch (error) {
    activeTasks.delete(key);
    log.w("Download", `surah ${surah} download failed: ${(error as Error)?.message}`);
    let saved: DownloadPauseState | null = null;
    try {
      saved = task?.savable() ?? null;
    } catch {
      saved = null;
    }
    return { done: false, resume: saved };
  }
};

// Pause an in-flight download (its downloadAsync resolves to null → resume state).
const pauseSurahDownload = (recitationId: string, surah: number): void => {
  void activeTasks.get(taskKey(recitationId, surah))?.pauseAsync();
};

const deleteSurahFile = (recitationId: string, surah: number, fileFormat: string): void => {
  const file = surahFile(recitationId, surah, fileFormat);
  if (file.exists) file.delete();
  log.i("Download", `surah ${surah} deleted for ${recitationId}`);
};

// Surah numbers saved for a reciter (parses `<n>.<ext>` filenames).
const downloadedSurahs = (recitationId: string, fileFormat: string): number[] => {
  const dir = recitationDir(recitationId);
  if (!dir.exists) return [];
  const re = new RegExp(`^(\\d+)\\.${fileFormat}$`);
  const out: number[] = [];
  for (const entry of dir.list()) {
    const m = (entry.uri.split("/").pop() ?? "").match(re);
    if (m) out.push(Number(m[1]));
  }
  return out;
};

// Total bytes used by a reciter's saved surahs.
const surahStorageBytes = (recitationId: string, fileFormat: string): number =>
  downloadedSurahs(recitationId, fileFormat).reduce(
    (sum, n) => sum + (surahFile(recitationId, n, fileFormat).size ?? 0),
    0
  );

const deleteAllSurahs = (recitationId: string, fileFormat: string): void => {
  for (const n of downloadedSurahs(recitationId, fileFormat)) {
    deleteSurahFile(recitationId, n, fileFormat);
  }
};

export const quranAudioDownload = {
  getLocalPath,
  hasSurah,
  downloadSurah,
  getSurahFilePath,
  downloadSurahFile,
  pauseSurahDownload,
  deleteSurahFile,
  downloadedSurahs,
  surahStorageBytes,
  deleteAllSurahs,
};

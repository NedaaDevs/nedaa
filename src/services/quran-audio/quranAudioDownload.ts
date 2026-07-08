import { File, Directory, Paths } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import type { QuranRecitation } from "@/types/quran-audio";
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

export const quranAudioDownload = { getLocalPath, hasSurah, downloadSurah };

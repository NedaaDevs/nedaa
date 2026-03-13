import { File, Directory, Paths } from "expo-file-system";

import { AthkarDB } from "@/services/athkar-db";
import { AUDIO_STORAGE, getThikrId } from "@/constants/AthkarAudio";
import { AppLogger } from "@/utils/appLogger";
import type { ReciterManifest } from "@/types/athkar-audio";

const log = AppLogger.create("athkar-audio");

const audioBaseDir = new Directory(Paths.document, AUDIO_STORAGE.AUDIO_DIR);

const ensureReciterDir = (reciterId: string): Directory => {
  const dir = new Directory(audioBaseDir, reciterId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
};

const downloadFile = async (
  reciterId: string,
  thikrId: string,
  url: string,
  size: number
): Promise<string | null> => {
  try {
    const dir = ensureReciterDir(reciterId);
    const localFile = new File(dir, `${thikrId}.mp3`);

    // Check if already downloaded (DB record + file on disk)
    const existing = await AthkarDB.getAudioDownload(reciterId, thikrId);
    if (existing) {
      const existingFile = new File(existing.file_path);
      if (existingFile.exists) return existing.file_path;
    }

    // File exists on disk but no DB record (e.g. interrupted previous download)
    if (localFile.exists) {
      if (localFile.size === size) {
        await AthkarDB.insertAudioDownload(reciterId, thikrId, localFile.uri, size);
        return localFile.uri;
      }
      // Partial/corrupt file — delete and re-download
      localFile.delete();
    }

    // Download
    await File.downloadFileAsync(url, localFile);

    // Record in DB
    await AthkarDB.insertAudioDownload(reciterId, thikrId, localFile.uri, size);

    return localFile.uri;
  } catch (error) {
    log.e("Download", `Error downloading ${thikrId}`, error instanceof Error ? error : undefined);
    return null;
  }
};

const downloadPack = async (
  reciterId: string,
  manifest: ReciterManifest,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number; failedIds: string[] }> => {
  const files = Object.entries(manifest.files);
  const total = files.length;
  let completed = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const [thikrId, fileEntry] of files) {
    const result = await downloadFile(reciterId, thikrId, fileEntry.url, fileEntry.size);
    if (result) {
      completed++;
    } else {
      failed++;
      failedIds.push(thikrId);
    }
    onProgress?.(completed + failed, total);
  }

  // Also download session files if present
  if (manifest.sessions) {
    for (const [sessionId, sessionEntry] of Object.entries(manifest.sessions)) {
      const sessionResult = await downloadFile(
        reciterId,
        `session-${sessionId}`,
        sessionEntry.url,
        sessionEntry.size
      );
      if (sessionResult) {
        completed++;
      } else {
        failed++;
        failedIds.push(`session-${sessionId}`);
      }
    }
  }

  log.i("Download", `Pack download complete: ${completed} ok, ${failed} failed`);
  return { success: completed, failed, failedIds };
};

const retryFailed = async (
  reciterId: string,
  manifest: ReciterManifest,
  failedIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number; failedIds: string[] }> => {
  log.i("Download", `Retrying ${failedIds.length} failed downloads`);
  const total = failedIds.length;
  let completed = 0;
  let failed = 0;
  const stillFailedIds: string[] = [];

  for (const thikrId of failedIds) {
    const isSession = thikrId.startsWith("session-");
    const fileEntry = isSession
      ? manifest.sessions?.[thikrId.replace("session-", "")]
      : manifest.files[thikrId];

    if (!fileEntry) {
      failed++;
      stillFailedIds.push(thikrId);
      onProgress?.(completed + failed, total);
      continue;
    }

    const result = await downloadFile(reciterId, thikrId, fileEntry.url, fileEntry.size);
    if (result) {
      completed++;
    } else {
      failed++;
      stillFailedIds.push(thikrId);
    }
    onProgress?.(completed + failed, total);
  }

  log.i("Download", `Retry complete: ${completed} ok, ${failed} still failed`);
  return { success: completed, failed, failedIds: stillFailedIds };
};

const prefetchUpcoming = async (
  reciterId: string,
  manifest: ReciterManifest,
  startIndex: number,
  thikrIds: string[],
  count = 3
): Promise<void> => {
  const upcoming = thikrIds.slice(startIndex, startIndex + count);

  for (const thikrId of upcoming) {
    const fileEntry = manifest.files[thikrId];
    if (!fileEntry) continue;

    const isDownloaded = await AthkarDB.isThikrDownloaded(reciterId, thikrId);
    if (isDownloaded) continue;

    await downloadFile(reciterId, thikrId, fileEntry.url, fileEntry.size);
  }
};

const getLocalPath = async (reciterId: string, thikrId: string): Promise<string | null> => {
  const download = await AthkarDB.getAudioDownload(reciterId, thikrId);
  if (!download) return null;

  // Verify file still exists
  const file = new File(download.file_path);
  if (!file.exists) {
    // File was deleted externally — clean up this specific DB record
    await AthkarDB.deleteAudioDownload(reciterId, thikrId);
    return null;
  }

  return download.file_path;
};

const deleteReciterPack = async (reciterId: string): Promise<boolean> => {
  try {
    const dir = new Directory(audioBaseDir, reciterId);
    if (dir.exists) {
      try {
        dir.delete();
      } catch {
        // Already deleted
      }
    }

    await AthkarDB.deleteReciterDownloads(reciterId);
    log.i("Download", `Deleted pack for ${reciterId}`);
    return true;
  } catch (error) {
    log.e("Download", "Error deleting reciter pack", error instanceof Error ? error : undefined);
    return false;
  }
};

const getStorageBreakdown = async (): Promise<{ reciterId: string; size: number }[]> => {
  try {
    if (!audioBaseDir.exists) return [];

    const entries = audioBaseDir.list();
    const breakdown: { reciterId: string; size: number }[] = [];

    for (const entry of entries) {
      const size = await AthkarDB.getAudioStorageUsed(entry.name);
      if (size > 0) {
        breakdown.push({ reciterId: entry.name, size });
      }
    }

    return breakdown;
  } catch (error) {
    log.e(
      "Download",
      "Error getting storage breakdown",
      error instanceof Error ? error : undefined
    );
    return [];
  }
};

const getThikrIdForAthkar = (order: number, sessionType: "morning" | "evening"): string | null => {
  return getThikrId(order, sessionType);
};

export const audioDownloadManager = {
  downloadFile,
  downloadPack,
  retryFailed,
  prefetchUpcoming,
  getLocalPath,
  deleteReciterPack,
  getStorageBreakdown,
  getThikrIdForAthkar,
};

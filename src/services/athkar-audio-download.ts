import * as FileSystem from "expo-file-system/legacy";

import { AthkarDB } from "@/services/athkar-db";
import { AUDIO_STORAGE, getThikrId } from "@/constants/AthkarAudio";

import type { ReciterManifest } from "@/types/athkar-audio";

const audioBaseDir = `${FileSystem.documentDirectory}${AUDIO_STORAGE.AUDIO_DIR}`;

const ensureReciterDir = async (reciterId: string) => {
  const dir = `${audioBaseDir}/${reciterId}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
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
    const dir = await ensureReciterDir(reciterId);
    const localPath = `${dir}/${thikrId}.mp3`;

    // Check if already downloaded
    const existing = await AthkarDB.getAudioDownload(reciterId, thikrId);
    if (existing) {
      const info = await FileSystem.getInfoAsync(existing.file_path);
      if (info.exists) return existing.file_path;
    }

    // Download
    const result = await FileSystem.downloadAsync(url, localPath);

    if (result.status !== 200) {
      console.error(`[AudioDownload] Failed to download ${thikrId}: status ${result.status}`);
      return null;
    }

    // Record in DB
    await AthkarDB.insertAudioDownload(reciterId, thikrId, localPath, size);

    return localPath;
  } catch (error) {
    console.error(`[AudioDownload] Error downloading ${thikrId}:`, error);
    return null;
  }
};

const downloadPack = async (
  reciterId: string,
  manifest: ReciterManifest,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> => {
  const files = Object.entries(manifest.files);
  const total = files.length;
  let completed = 0;
  let failed = 0;

  for (const [thikrId, fileEntry] of files) {
    const result = await downloadFile(reciterId, thikrId, fileEntry.url, fileEntry.size);
    if (result) {
      completed++;
    } else {
      failed++;
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
      }
    }
  }

  return { success: completed, failed };
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
  const info = await FileSystem.getInfoAsync(download.file_path);
  if (!info.exists) {
    // File was deleted externally — clean up this specific DB record
    await AthkarDB.deleteAudioDownload(reciterId, thikrId);
    return null;
  }

  return download.file_path;
};

const deleteReciterPack = async (reciterId: string): Promise<boolean> => {
  try {
    const dir = `${audioBaseDir}/${reciterId}`;
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }

    await AthkarDB.deleteReciterDownloads(reciterId);
    return true;
  } catch (error) {
    console.error("[AudioDownload] Error deleting reciter pack:", error);
    return false;
  }
};

const getStorageBreakdown = async (): Promise<{ reciterId: string; size: number }[]> => {
  try {
    const baseInfo = await FileSystem.getInfoAsync(audioBaseDir);
    if (!baseInfo.exists) return [];

    const entries = await FileSystem.readDirectoryAsync(audioBaseDir);
    const breakdown: { reciterId: string; size: number }[] = [];

    for (const reciterId of entries) {
      const size = await AthkarDB.getAudioStorageUsed(reciterId);
      if (size > 0) {
        breakdown.push({ reciterId, size });
      }
    }

    return breakdown;
  } catch (error) {
    console.error("[AudioDownload] Error getting storage breakdown:", error);
    return [];
  }
};

const getThikrIdForAthkar = (order: number, sessionType: "morning" | "evening"): string | null => {
  return getThikrId(order, sessionType);
};

export const audioDownloadManager = {
  downloadFile,
  downloadPack,
  prefetchUpcoming,
  getLocalPath,
  deleteReciterPack,
  getStorageBreakdown,
  getThikrIdForAthkar,
};

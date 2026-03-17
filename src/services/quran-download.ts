import { File, Directory, Paths } from "expo-file-system";

import { MushafVersion, MushafImageType, DownloadStatus, PageDownloadStatus } from "@/enums/quran";
import {
  TOTAL_PAGES,
  LINES_PER_PAGE,
  DOWNLOAD_CONCURRENCY,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS_MS,
} from "@/constants/Quran";
import * as SQLite from "expo-sqlite";

import { QuranDB } from "@/services/quran-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadProgress, QuranManifestVersion } from "@/types/quran";

const log = AppLogger.create("quran-download");

let activeVersion: MushafVersion | null = null;
let isPaused = false;
let isCancelled = false;
const priorityPages = new Set<number>();
let lastSurahName = "";

const getLinePageDir = (version: MushafVersion, page: number): Directory => {
  const pageStr = String(page).padStart(3, "0");
  return new Directory(Paths.document, `quran/${version}/lines/${pageStr}`);
};

const getLineFile = (version: MushafVersion, page: number, line: number): File => {
  const pageStr = String(page).padStart(3, "0");
  const lineStr = String(line).padStart(3, "0");
  return new File(Paths.document, `quran/${version}/lines/${pageStr}/${lineStr}.png`);
};

const getPageFile = (version: MushafVersion, page: number): File => {
  const pageStr = String(page).padStart(3, "0");
  return new File(Paths.document, `quran/${version}/pages/${pageStr}.png`);
};

const getPagesDir = (version: MushafVersion): Directory => {
  return new Directory(Paths.document, `quran/${version}/pages`);
};

const getBoundsDbFile = (version: MushafVersion): File => {
  return new File(SQLite.defaultDatabaseDirectory, `bounds-${version}.db`);
};

const downloadBoundsDb = async (
  version: MushafVersion,
  manifestVersion: QuranManifestVersion
): Promise<void> => {
  const boundsFile = getBoundsDbFile(version);
  if (boundsFile.exists) {
    log.i("Download", `bounds-${version}.db already exists`);
    return;
  }

  const url = QuranManifestService.getBoundsDbUrl(manifestVersion);
  log.i("Download", `Downloading bounds-${version}.db from ${url}`);
  await File.downloadFileAsync(url, boundsFile);
  log.i("Download", `bounds-${version}.db downloaded (${boundsFile.size} bytes)`);
};

const verifyPageOnDisk = (
  version: MushafVersion,
  page: number,
  imageType: MushafImageType = MushafImageType.LINE
): boolean => {
  if (imageType === MushafImageType.PAGE) {
    return getPageFile(version, page).exists;
  }
  for (let line = 1; line <= LINES_PER_PAGE; line++) {
    if (!getLineFile(version, page, line).exists) return false;
  }
  return true;
};

const downloadPage = async (
  version: MushafVersion,
  manifestVersion: QuranManifestVersion,
  page: number
): Promise<{ success: boolean; totalBytes: number }> => {
  if (isPaused || isCancelled) {
    return { success: false, totalBytes: 0 };
  }

  await QuranDB.updatePageStatus(version, page, PageDownloadStatus.DOWNLOADING);

  let totalBytes = 0;

  if (manifestVersion.type === MushafImageType.PAGE) {
    // Single image per page
    const dir = getPagesDir(version);
    if (!dir.exists) dir.create({ intermediates: true });

    const file = getPageFile(version, page);
    if (file.exists) {
      totalBytes = file.size ?? 0;
    } else {
      const url = QuranManifestService.getPageImageUrl(manifestVersion, page);
      await File.downloadFileAsync(url, file);
      totalBytes = file.size ?? 0;
    }
  } else {
    // 15 line images per page (parallel)
    const dir = getLinePageDir(version, page);
    if (!dir.exists) dir.create({ intermediates: true });

    const lineDownloads = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1).map(
      async (line) => {
        const file = getLineFile(version, page, line);
        if (file.exists) return file.size ?? 0;
        const url = QuranManifestService.getLineImageUrl(manifestVersion, page, line);
        await File.downloadFileAsync(url, file);
        return file.size ?? 0;
      }
    );

    const sizes = await Promise.all(lineDownloads);
    for (const size of sizes) totalBytes += size;
  }

  await QuranDB.updatePageStatus(version, page, PageDownloadStatus.COMPLETE, totalBytes);
  return { success: true, totalBytes };
};

const downloadPageWithRetry = async (
  version: MushafVersion,
  manifestVersion: QuranManifestVersion,
  page: number
): Promise<{ success: boolean; totalBytes: number }> => {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await downloadPage(version, manifestVersion, page);
    } catch (error) {
      log.e(
        "Download",
        `Page ${page} attempt ${attempt + 1} failed`,
        error instanceof Error ? error : undefined
      );

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = RETRY_DELAYS_MS[attempt] ?? 10000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  await QuranDB.updatePageStatus(version, page, PageDownloadStatus.FAILED);
  return { success: false, totalBytes: 0 };
};

const getNextPages = async (version: MushafVersion, limit: number): Promise<number[]> => {
  const prioritized: number[] = [];
  for (const p of priorityPages) {
    const isComplete = await QuranDB.isPageComplete(version, p);
    if (!isComplete) prioritized.push(p);
    if (prioritized.length >= limit) break;
  }

  if (prioritized.length >= limit) return prioritized;

  const remaining = limit - prioritized.length;
  const pending = await QuranDB.getPendingPages(version, remaining + prioritized.length);
  const filtered = pending.filter((p) => !prioritized.includes(p));

  return [...prioritized, ...filtered.slice(0, remaining)];
};

const emitProgress = async (version: MushafVersion): Promise<void> => {
  const counts = await QuranDB.getDownloadCounts(version);
  const bytes = await QuranDB.getTotalDownloadedBytes(version);

  const progress: DownloadProgress = {
    currentPage: counts.completed,
    totalPages: counts.total,
    completedPages: counts.completed,
    failedPages: counts.failed,
    bytesDownloaded: bytes,
    totalBytes: counts.total * LINES_PER_PAGE * 15000,
    currentSurahName: lastSurahName,
  };

  useQuranStore.getState().updateDownloadState(version, { progress });
};

const downloadLoop = async (
  version: MushafVersion,
  manifestVersion: QuranManifestVersion
): Promise<void> => {
  while (!isPaused && !isCancelled) {
    const pages = await getNextPages(version, DOWNLOAD_CONCURRENCY);
    if (pages.length === 0) break;

    const surahName = await QuranDB.getSurahForPage(version, pages[0]);
    if (surahName) lastSurahName = surahName;

    await Promise.all(pages.map((page) => downloadPageWithRetry(version, manifestVersion, page)));

    for (const page of pages) {
      priorityPages.delete(page);
    }

    await emitProgress(version);

    const counts = await QuranDB.getDownloadCounts(version);
    if (counts.completed === counts.total) break;
    if (counts.pending === 0 && priorityPages.size === 0) break;
  }
};

const start = async (version: MushafVersion): Promise<void> => {
  if (activeVersion === version) {
    log.i("Download", "Already downloading this version");
    return;
  }

  const manifestVersion = await QuranManifestService.getVersionInfo(version);
  if (!manifestVersion) {
    log.e("Download", `No manifest data for ${version}`);
    useQuranStore.getState().updateDownloadState(version, { status: DownloadStatus.ERROR });
    return;
  }

  activeVersion = version;

  isPaused = false;
  isCancelled = false;
  priorityPages.clear();

  const store = useQuranStore.getState();
  store.updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });

  log.i("Download", `start() called for ${version}, manifest baseUrl: ${manifestVersion.baseUrl}`);

  // Download bounds.db first — needed for the reader to function
  await downloadBoundsDb(version, manifestVersion);

  await QuranDB.initializeDownloadPages(version, TOTAL_PAGES);

  // Spot-check previously completed pages still have files on disk
  const counts = await QuranDB.getDownloadCounts(version);
  if (counts.completed > 0) {
    log.i("Download", `Verifying ${counts.completed} previously completed pages`);
    const sampleSize = Math.min(counts.completed, 20);
    const db = await QuranDB.openDownloadDb();
    const completedPages = await db.getAllAsync<{ page: number }>(
      "SELECT page FROM quran_downloads WHERE version = ? AND status = 'complete' ORDER BY RANDOM() LIMIT ?",
      [version, sampleSize]
    );
    for (const { page } of completedPages) {
      if (!verifyPageOnDisk(version, page, manifestVersion.type)) {
        await QuranDB.updatePageStatus(version, page, PageDownloadStatus.PENDING);
        log.i("Download", `Page ${page} missing from disk, reset to pending`);
      }
    }
  }

  await emitProgress(version);

  const pendingCounts = await QuranDB.getDownloadCounts(version);
  log.i(
    "Download",
    `Starting download loop for ${version}: ${pendingCounts.completed} complete, ${pendingCounts.pending} pending, ${pendingCounts.failed} failed`
  );

  try {
    await downloadLoop(version, manifestVersion);

    const finalCounts = await QuranDB.getDownloadCounts(version);
    if (finalCounts.completed === finalCounts.total) {
      store.updateDownloadState(version, { status: DownloadStatus.COMPLETE });
      log.i("Download", `${version} download complete`);
    } else if (isPaused) {
      store.updateDownloadState(version, { status: DownloadStatus.PAUSED });
    } else if (finalCounts.failed > 0) {
      store.updateDownloadState(version, { status: DownloadStatus.ERROR });
    }
  } catch (error) {
    log.e("Download", "Download loop error", error instanceof Error ? error : undefined);
    store.updateDownloadState(version, { status: DownloadStatus.ERROR });
  } finally {
    activeVersion = null;
  }
};

const pause = (): void => {
  isPaused = true;
  log.i("Download", "Download paused");
};

const resume = async (): Promise<void> => {
  const selectedVersion = useQuranStore.getState().selectedVersion;
  if (!activeVersion && selectedVersion) {
    await start(selectedVersion);
  }
};

const cancel = async (): Promise<void> => {
  isCancelled = true;
  if (activeVersion) {
    useQuranStore.getState().updateDownloadState(activeVersion, { status: DownloadStatus.IDLE });
  }
  activeVersion = null;
  activeManifestVersion = null;
  log.i("Download", "Download cancelled");
};

const prioritizePage = (page: number): void => {
  priorityPages.add(page);
  if (page > 2) priorityPages.add(page - 2);
  if (page > 1) priorityPages.add(page - 1);
  if (page < TOTAL_PAGES) priorityPages.add(page + 1);
  if (page < TOTAL_PAGES - 1) priorityPages.add(page + 2);
};

const detectImageType = (version: MushafVersion): MushafImageType => {
  const pagesDir = getPagesDir(version);
  if (pagesDir.exists) return MushafImageType.PAGE;
  return MushafImageType.LINE;
};

const isPageAvailable = (version: MushafVersion, page: number): boolean => {
  return verifyPageOnDisk(version, page, detectImageType(version));
};

const verifyIntegrity = async (
  version: MushafVersion
): Promise<{ total: number; missing: number }> => {
  const imageType = detectImageType(version);
  let missing = 0;
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    if (!verifyPageOnDisk(version, page, imageType)) missing++;
  }
  return { total: TOTAL_PAGES, missing };
};

const getStorageUsage = async (): Promise<Partial<Record<MushafVersion, number>>> => {
  const usage: Partial<Record<MushafVersion, number>> = {};
  for (const version of Object.values(MushafVersion)) {
    const bytes = await QuranDB.getTotalDownloadedBytes(version);
    if (bytes > 0) usage[version] = bytes;
  }
  return usage;
};

const deleteVersion = async (version: MushafVersion): Promise<void> => {
  const versionDir = new Directory(Paths.document, `quran/${version}`);
  if (versionDir.exists) {
    try {
      versionDir.delete();
    } catch {
      log.e("Download", `Error deleting ${version} directory`);
    }
  }

  await QuranDB.closeBoundsDb(version);

  const boundsFile = getBoundsDbFile(version);
  if (boundsFile.exists) {
    try {
      boundsFile.delete();
    } catch {
      log.e("Download", `Error deleting bounds-${version}.db`);
    }
  }

  await QuranDB.deleteVersionDownloads(version);
  useQuranStore.getState().updateDownloadState(version, {
    status: DownloadStatus.IDLE,
    progress: null,
  });
  log.i("Download", `Deleted version ${version}`);
};

const checkDiskSpace = (requiredMB: number): { available: boolean; availableMB: number } => {
  try {
    const availableBytes = File.availableDiskSpace;
    if (!availableBytes || !Number.isFinite(availableBytes)) {
      return { available: true, availableMB: -1 };
    }
    const availableMB = Math.floor(availableBytes / (1024 * 1024));
    return { available: availableMB >= requiredMB, availableMB };
  } catch {
    return { available: true, availableMB: -1 };
  }
};

export const QuranDownload = {
  start,
  pause,
  resume,
  cancel,
  prioritizePage,
  isPageAvailable,
  getImageType: detectImageType,
  verifyIntegrity,
  getStorageUsage,
  deleteVersion,
  checkDiskSpace,
};

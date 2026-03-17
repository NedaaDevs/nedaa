import { File, Directory, Paths } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import { MushafVersion, MushafImageType, DownloadStatus, PageDownloadStatus } from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { QuranDB } from "@/services/quran-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-download");

let activeVersion: MushafVersion | null = null;

const getVersionDir = (version: MushafVersion): Directory => {
  return new Directory(Paths.document, `quran/${version}`);
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

const detectImageType = (version: MushafVersion): MushafImageType => {
  const pagesDir = getPagesDir(version);
  if (pagesDir.exists) return MushafImageType.PAGE;
  return MushafImageType.LINE;
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
  const store = useQuranStore.getState();
  store.updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });

  log.i("Download", `start() for ${version}, baseUrl: ${manifestVersion.baseUrl}`);

  try {
    const versionDir = getVersionDir(version);

    // Check if already fully extracted
    const imageType = manifestVersion.type;
    let allPresent = true;
    for (let p = 1; p <= 5; p++) {
      if (!verifyPageOnDisk(version, p, imageType)) {
        allPresent = false;
        break;
      }
    }

    if (!allPresent) {
      // Download bundle ZIP
      const bundleUrl = `${manifestVersion.baseUrl}${manifestVersion.paths.bundle}`;
      const zipFile = new File(Paths.cache, `quran-${version}-bundle.zip`);

      log.i("Download", `Downloading bundle from ${bundleUrl}`);
      await File.downloadFileAsync(bundleUrl, zipFile);
      log.i("Download", `Bundle downloaded (${zipFile.size} bytes)`);

      // Extract to version directory
      if (!versionDir.exists) {
        versionDir.create({ intermediates: true });
      }

      log.i("Download", `Extracting to ${versionDir.uri}`);
      await unzip(zipFile.uri, versionDir.uri);
      log.i("Download", "Extraction complete");

      // Move bounds.db to SQLite directory if it was in the bundle
      const extractedBoundsDb = new File(versionDir, "bounds.db");
      if (extractedBoundsDb.exists) {
        const targetBoundsDb = getBoundsDbFile(version);
        if (targetBoundsDb.exists) targetBoundsDb.delete();
        extractedBoundsDb.move(targetBoundsDb);
        log.i("Download", `Moved bounds.db to ${targetBoundsDb.uri}`);
      }

      // Clean up ZIP
      if (zipFile.exists) zipFile.delete();
    }

    // Mark all pages as complete in the download tracking DB
    await QuranDB.initializeDownloadPages(version, TOTAL_PAGES);
    const db = await QuranDB.openDownloadDb();
    await db.runAsync(`UPDATE quran_downloads SET status = ?, updated_at = ? WHERE version = ?`, [
      PageDownloadStatus.COMPLETE,
      Date.now(),
      version,
    ]);

    store.updateDownloadState(version, { status: DownloadStatus.COMPLETE });
    log.i("Download", `${version} complete`);
  } catch (error) {
    log.e("Download", "Download failed", error instanceof Error ? error : undefined);
    useQuranStore.getState().updateDownloadState(version, { status: DownloadStatus.ERROR });
  } finally {
    activeVersion = null;
  }
};

const pause = (): void => {
  log.i("Download", "Pause not supported for bundle downloads");
};

const resume = async (): Promise<void> => {
  const selectedVersion = useQuranStore.getState().selectedVersion;
  if (!activeVersion && selectedVersion) {
    await start(selectedVersion);
  }
};

const cancel = async (): Promise<void> => {
  if (activeVersion) {
    useQuranStore.getState().updateDownloadState(activeVersion, { status: DownloadStatus.IDLE });
  }
  activeVersion = null;
  log.i("Download", "Download cancelled");
};

const prioritizePage = (_page: number): void => {
  // No-op for bundle downloads — all pages arrive at once
};

const isPageAvailable = (version: MushafVersion, page: number): boolean => {
  return verifyPageOnDisk(version, page, detectImageType(version));
};

const getImageType = (version: MushafVersion): MushafImageType => {
  return detectImageType(version);
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
  const versionDir = getVersionDir(version);
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
  getImageType,
  verifyIntegrity,
  getStorageUsage,
  deleteVersion,
  checkDiskSpace,
};

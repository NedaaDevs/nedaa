import { File, Directory, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import { MushafVersion, MushafImageType, DownloadStatus } from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { QuranDB } from "@/services/quran-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadPhase } from "@/types/quran";

const log = AppLogger.create("quran-download");

let activeVersion: MushafVersion | null = null;

const emitProgress = (
  version: MushafVersion,
  phase: DownloadPhase,
  bytesDownloaded: number,
  totalBytes: number
) => {
  const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
  useQuranStore.getState().updateDownloadState(version, {
    progress: { phase, bytesDownloaded, totalBytes, percent },
  });
};

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
  const dir = SQLite.defaultDatabaseDirectory;
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  return new File(dirUri, `bounds-${version}.db`);
};

const verifyPageOnDisk = (
  version: MushafVersion,
  page: number,
  imageType: MushafImageType = MushafImageType.LINE
): boolean => {
  try {
    if (imageType === MushafImageType.PAGE) {
      return getPageFile(version, page).exists;
    }
    for (let line = 1; line <= LINES_PER_PAGE; line++) {
      if (!getLineFile(version, page, line).exists) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const detectImageType = (version: MushafVersion): MushafImageType => {
  try {
    const pagesDir = getPagesDir(version);
    if (pagesDir.exists) return MushafImageType.PAGE;
  } catch {
    // Directory check failed (e.g. Android URI issue) — default to LINE
  }
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
    const imageType = detectImageType(version);
    let allPresent = true;
    for (let p = 1; p <= 5; p++) {
      if (!verifyPageOnDisk(version, p, imageType)) {
        allPresent = false;
        break;
      }
    }

    if (!allPresent) {
      // Phase 1: Download bundle ZIP with progress
      const bundleUrl = `${manifestVersion.baseUrl}${manifestVersion.paths.bundle}`;
      const zipPath = `${Paths.cache.uri}quran-${version}-bundle.zip`;
      const totalBytes = (manifestVersion.bundleSizeMB || 100) * 1024 * 1024;

      emitProgress(version, "downloading", 0, totalBytes);
      log.i("Download", `Downloading bundle from ${bundleUrl}`);

      const downloadResumable = LegacyFS.createDownloadResumable(
        bundleUrl,
        zipPath,
        {},
        (progress) => {
          emitProgress(
            version,
            "downloading",
            progress.totalBytesWritten,
            progress.totalBytesExpectedToWrite
          );
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result) throw new Error("Download returned no result");
      log.i("Download", `Bundle downloaded (${result.uri})`);

      // Phase 2: Extract
      emitProgress(version, "extracting", 0, 0);
      if (!versionDir.exists) {
        versionDir.create({ intermediates: true });
      }

      log.i("Download", `Extracting to ${versionDir.uri}`);
      await unzip(result.uri, versionDir.uri);
      log.i("Download", "Extraction complete");

      // Phase 3: Finalize
      emitProgress(version, "finalizing", 0, 0);

      // Move bounds.db to SQLite directory if it was in the bundle
      const extractedBoundsDb = new File(versionDir, "bounds.db");
      if (extractedBoundsDb.exists) {
        const targetBoundsDb = getBoundsDbFile(version);
        if (targetBoundsDb.exists) targetBoundsDb.delete();
        extractedBoundsDb.move(targetBoundsDb);
        log.i("Download", `Moved bounds.db to ${targetBoundsDb.uri}`);
      }

      // Clean up ZIP
      const zipFile = new File(zipPath);
      if (zipFile.exists) zipFile.delete();
    }

    // Mark all pages as complete in the download tracking DB
    await QuranDB.initializeDownloadPages(version, TOTAL_PAGES);
    await QuranDB.markVersionComplete(version);

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
  useQuranStore.getState().removeVersion(version);
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

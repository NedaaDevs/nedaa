import { File, Directory, Paths } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import { MushafVersion, MushafImageType, DownloadStatus } from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { QuranDB } from "@/services/quran-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { downloadFile } from "@/services/api";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadPhase } from "@/types/quran";

const log = AppLogger.create("quran-download");

type ActiveDownload = {
  controller: AbortController;
  cancelled: boolean;
  promise: Promise<void>;
};

// In-flight downloads keyed by version: the entry is the synchronous
// "already downloading?" guard and holds the AbortController for cancellation.
const activeDownloads = new Map<MushafVersion, ActiveDownload>();

const emitProgress = (
  version: MushafVersion,
  phase: DownloadPhase,
  bytesDownloaded: number,
  totalBytes: number
) => {
  const percent =
    totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;
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

// Synchronous entry point. Registers the in-flight download before any await
// so two rapid calls for the same version can't both pass the guard, then
// delegates the work to doStart.
const start = (version: MushafVersion): Promise<void> => {
  const existing = activeDownloads.get(version);
  if (existing) {
    log.d("Download", `Already downloading ${version}`);
    return existing.promise;
  }

  const active: ActiveDownload = {
    controller: new AbortController(),
    cancelled: false,
    promise: Promise.resolve(),
  };
  activeDownloads.set(version, active);
  const run = doStart(version, active);
  active.promise = run;
  return run;
};

const doStart = async (version: MushafVersion, active: ActiveDownload): Promise<void> => {
  const store = useQuranStore.getState();
  store.updateDownloadState(version, { status: DownloadStatus.DOWNLOADING });

  try {
    const manifestVersion = await QuranManifestService.getVersionInfo(version);
    if (active.cancelled) return;
    if (!manifestVersion) {
      log.e("Download", `No manifest data for ${version}`);
      store.updateDownloadState(version, { status: DownloadStatus.ERROR });
      return;
    }

    log.i("Download", `Starting download for ${version}`);
    const versionDir = getVersionDir(version);

    // Skip the download if the version is already fully extracted on disk.
    const imageType = detectImageType(version);
    let allPresent = true;
    for (let p = 1; p <= 5; p++) {
      if (!verifyPageOnDisk(version, p, imageType)) {
        allPresent = false;
        break;
      }
    }

    if (!allPresent) {
      const bundleUrl = `${manifestVersion.baseUrl}${manifestVersion.paths.bundle}`;
      const zipFile = new File(Paths.cache, `quran-${version}-bundle.zip`);

      try {
        // Native download reports no incremental progress — the UI shows an
        // indeterminate indicator for this phase.
        emitProgress(version, "downloading", 0, 0);
        log.d("Download", `Downloading bundle from ${bundleUrl}`);

        const result = await downloadFile(bundleUrl, zipFile, {
          signal: active.controller.signal,
        });

        if (active.cancelled || result.cancelled) return;
        if (!result.success) throw new Error(result.message ?? "Download failed");
        log.d("Download", "Bundle downloaded");

        emitProgress(version, "extracting", 0, 0);
        if (!versionDir.exists) versionDir.create({ intermediates: true });
        await unzip(zipFile.uri, versionDir.uri);
        log.d("Download", "Extraction complete");
        if (active.cancelled) return;

        emitProgress(version, "finalizing", 0, 0);

        // Move bounds.db to the SQLite directory if it shipped in the bundle.
        const extractedBoundsDb = new File(versionDir, "bounds.db");
        if (extractedBoundsDb.exists) {
          const targetBoundsDb = getBoundsDbFile(version);
          if (targetBoundsDb.exists) targetBoundsDb.delete();
          extractedBoundsDb.move(targetBoundsDb);
          log.d("Download", "Moved bounds.db into place");
        }
      } finally {
        // Always remove the transient zip — success, cancel, or error.
        if (zipFile.exists) zipFile.delete();
      }
    }

    if (active.cancelled) return;

    await QuranDB.initializeDownloadPages(version, TOTAL_PAGES);
    await QuranDB.markVersionComplete(version);

    if (active.cancelled) return;
    store.updateDownloadState(version, { status: DownloadStatus.COMPLETE });
    log.i("Download", `${version} complete`);
  } catch (error) {
    if (active.cancelled) {
      log.i("Download", `${version} download cancelled`);
    } else {
      log.e(
        "Download",
        `Download failed for ${version}`,
        error instanceof Error ? error : undefined
      );
      useQuranStore.getState().updateDownloadState(version, { status: DownloadStatus.ERROR });
    }
  } finally {
    activeDownloads.delete(version);
  }
};

const pause = (): void => {
  log.d("Download", "Pause not supported for bundle downloads");
};

const resume = async (): Promise<void> => {
  const selectedVersion = useQuranStore.getState().selectedVersion;
  if (activeDownloads.size === 0 && selectedVersion) {
    await start(selectedVersion);
  }
};

const cancel = async (version?: MushafVersion): Promise<void> => {
  const targets = version ? [version] : [...activeDownloads.keys()];
  for (const v of targets) {
    const active = activeDownloads.get(v);
    if (!active) continue;
    active.cancelled = true;
    active.controller.abort();
    useQuranStore.getState().updateDownloadState(v, { status: DownloadStatus.IDLE });
    log.i("Download", `Cancelled download for ${v}`);
  }
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
  // Cancel any in-flight download for this version. The native transfer can't
  // be aborted mid-flight, but the cancelled flag makes doStart bail before it
  // extracts or marks complete, so deleting the files now is safe.
  const active = activeDownloads.get(version);
  if (active) {
    active.cancelled = true;
    active.controller.abort();
  }

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
    const availableBytes = Paths.availableDiskSpace;
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

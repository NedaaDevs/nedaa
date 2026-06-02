import { File, Directory, Paths } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import { MushafVersion, MushafImageType, DownloadStatus, DownloadPhase } from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { QuranDB } from "@/services/quran-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { downloadFile } from "@/services/api";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadProgress } from "@/types/quran";

const log = AppLogger.create("quran-download");

type ActiveDownload = {
  controller: AbortController;
  cancelled: boolean;
  promise: Promise<void>;
};

// In-flight downloads keyed by version: the entry is the synchronous
// "already downloading?" guard and holds the AbortController for cancellation.
const activeDownloads = new Map<MushafVersion, ActiveDownload>();

// Independent in-flight guard for the optional dark-theme bundle.
const activeDarkDownloads = new Map<MushafVersion, ActiveDownload>();

const buildProgress = (
  phase: DownloadPhase,
  bytesDownloaded: number,
  totalBytes: number
): DownloadProgress => {
  const percent =
    totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;
  return { phase, bytesDownloaded, totalBytes, percent };
};

const getVersionDir = (version: MushafVersion): Directory => {
  return new Directory(Paths.document, `quran/${version}`);
};

// Dark-theme images live in a sibling directory so they can be downloaded and
// deleted independently of the main (light) bundle.
const getDarkVersionDir = (version: MushafVersion): Directory => {
  return new Directory(Paths.document, `quran/${version}-dark`);
};

const darkFirstPagePresent = (version: MushafVersion, imageType: MushafImageType): boolean => {
  try {
    if (imageType === MushafImageType.PAGE) {
      return new File(Paths.document, `quran/${version}-dark/pages/001.png`).exists;
    }
    return new File(Paths.document, `quran/${version}-dark/lines/001/001.png`).exists;
  } catch {
    return false;
  }
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

// Registers an in-flight download in `map` before any await so two rapid calls
// for the same version can't both pass the guard, then runs `run`.
const beginDownload = (
  map: Map<MushafVersion, ActiveDownload>,
  version: MushafVersion,
  run: (version: MushafVersion, active: ActiveDownload) => Promise<void>
): Promise<void> => {
  const existing = map.get(version);
  if (existing) {
    log.d("Download", `Already downloading ${version}`);
    return existing.promise;
  }

  const active: ActiveDownload = {
    controller: new AbortController(),
    cancelled: false,
    promise: Promise.resolve(),
  };
  map.set(version, active);
  const promise = run(version, active);
  active.promise = promise;
  return promise;
};

type BundleDownloadOptions = {
  url: string;
  sizeBytes: number;
  dir: Directory;
  zipName: string;
  alreadyOnDisk: boolean;
  emit: (phase: DownloadPhase, bytesDownloaded: number, totalBytes: number) => void;
  // Light-only: runs under the FINALIZING phase after extraction (e.g. move bounds.db).
  onExtracted?: () => Promise<void> | void;
};

// Shared download → extract → zip-cleanup, used for both the light and dark
// bundles. Returns false if cancelled mid-flight, true if extracted (or already
// on disk); throws on a real download/extract error so the caller sets ERROR.
const downloadAndExtractBundle = async (
  active: ActiveDownload,
  opts: BundleDownloadOptions
): Promise<boolean> => {
  if (opts.alreadyOnDisk) return true;

  const zipFile = new File(Paths.cache, opts.zipName);
  try {
    opts.emit(DownloadPhase.DOWNLOADING, 0, opts.sizeBytes);
    log.d("Download", `Downloading bundle from ${opts.url}`);

    const result = await downloadFile(opts.url, zipFile, {
      signal: active.controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        // Server may omit Content-Length (totalBytes === -1); fall back to the
        // size declared in the manifest so the bar still advances.
        const total = totalBytes > 0 ? totalBytes : opts.sizeBytes;
        opts.emit(DownloadPhase.DOWNLOADING, bytesWritten, total);
      },
    });

    if (active.cancelled || result.cancelled) return false;
    if (!result.success) throw new Error(result.message ?? "Download failed");

    opts.emit(DownloadPhase.EXTRACTING, 0, 0);
    if (!opts.dir.exists) opts.dir.create({ intermediates: true });
    await unzip(zipFile.uri, opts.dir.uri);
    log.d("Download", "Extraction complete");
    if (active.cancelled) return false;

    if (opts.onExtracted) {
      opts.emit(DownloadPhase.FINALIZING, 0, 0);
      await opts.onExtracted();
    }
    return true;
  } finally {
    // Always remove the transient zip — success, cancel, or error.
    if (zipFile.exists) zipFile.delete();
  }
};

const start = (version: MushafVersion): Promise<void> =>
  beginDownload(activeDownloads, version, doStart);

const startDark = (version: MushafVersion): Promise<void> =>
  beginDownload(activeDarkDownloads, version, doStartDark);

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

    const extracted = await downloadAndExtractBundle(active, {
      url: QuranManifestService.getBundleUrl(manifestVersion),
      sizeBytes: QuranManifestService.getBundleSizeBytes(manifestVersion),
      dir: versionDir,
      zipName: `quran-${version}-bundle.zip`,
      alreadyOnDisk: allPresent,
      emit: (phase, bytes, total) =>
        store.updateDownloadState(version, { progress: buildProgress(phase, bytes, total) }),
      onExtracted: () => {
        // Move bounds.db to the SQLite directory if it shipped in the bundle.
        const extractedBoundsDb = new File(versionDir, "bounds.db");
        if (extractedBoundsDb.exists) {
          const targetBoundsDb = getBoundsDbFile(version);
          if (targetBoundsDb.exists) targetBoundsDb.delete();
          extractedBoundsDb.move(targetBoundsDb);
          log.d("Download", "Moved bounds.db into place");
        }
      },
    });
    if (!extracted || active.cancelled) return;

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

const doStartDark = async (version: MushafVersion, active: ActiveDownload): Promise<void> => {
  const store = useQuranStore.getState();
  store.updateDarkDownloadState(version, { status: DownloadStatus.DOWNLOADING });

  try {
    const manifestVersion = await QuranManifestService.getVersionInfo(version);
    if (active.cancelled) return;
    const darkUrl = manifestVersion ? QuranManifestService.getDarkBundleUrl(manifestVersion) : null;
    if (!manifestVersion || !darkUrl) {
      log.e("Download", `No dark bundle for ${version}`);
      store.updateDarkDownloadState(version, { status: DownloadStatus.ERROR });
      return;
    }

    const imageType = detectImageType(version);
    const extracted = await downloadAndExtractBundle(active, {
      url: darkUrl,
      sizeBytes: QuranManifestService.getDarkBundleSizeBytes(manifestVersion),
      dir: getDarkVersionDir(version),
      zipName: `quran-${version}-dark-bundle.zip`,
      alreadyOnDisk: darkFirstPagePresent(version, imageType),
      emit: (phase, bytes, total) =>
        store.updateDarkDownloadState(version, { progress: buildProgress(phase, bytes, total) }),
    });
    if (!extracted || active.cancelled) return;

    store.updateDarkDownloadState(version, { status: DownloadStatus.COMPLETE, progress: null });
    log.i("Download", `${version} dark complete`);
  } catch (error) {
    if (active.cancelled) {
      log.i("Download", `${version} dark download cancelled`);
    } else {
      log.e(
        "Download",
        `Dark download failed for ${version}`,
        error instanceof Error ? error : undefined
      );
      useQuranStore.getState().updateDarkDownloadState(version, { status: DownloadStatus.ERROR });
    }
  } finally {
    activeDarkDownloads.delete(version);
  }
};

const deleteDark = (version: MushafVersion): void => {
  const active = activeDarkDownloads.get(version);
  if (active) {
    active.cancelled = true;
    active.controller.abort();
  }

  const darkDir = getDarkVersionDir(version);
  if (darkDir.exists) {
    try {
      darkDir.delete();
    } catch {
      log.e("Download", `Error deleting ${version} dark directory`);
    }
  }

  useQuranStore.getState().removeDark(version);
  log.i("Download", `Deleted dark bundle for ${version}`);
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

  const darkActive = activeDarkDownloads.get(version);
  if (darkActive) {
    darkActive.cancelled = true;
    darkActive.controller.abort();
  }

  const versionDir = getVersionDir(version);
  if (versionDir.exists) {
    try {
      versionDir.delete();
    } catch {
      log.e("Download", `Error deleting ${version} directory`);
    }
  }

  // Remove the dark sibling directory too — deleting a version drops both bundles.
  const darkDir = getDarkVersionDir(version);
  if (darkDir.exists) {
    try {
      darkDir.delete();
    } catch {
      log.e("Download", `Error deleting ${version} dark directory`);
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
  startDark,
  deleteDark,
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

import { Directory, DownloadTask, File, Paths } from "expo-file-system";
import type { DownloadPauseState, DownloadTaskOptions } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import {
  MushafVersion,
  MushafImageType,
  DownloadStatus,
  DownloadPhase,
  BundleOutcome,
} from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadProgress } from "@/types/quran";

const log = AppLogger.create("quran-download");

type ActiveDownload = {
  controller: AbortController;
  cancelled: boolean;
  task?: DownloadTask;
  promise: Promise<void>;
};

// Resume state for a paused/interrupted light-bundle download. Held in memory
// for in-session resume and mirrored to a small file so a re-download after the
// app is killed continues from the byte offset (R2 honors HTTP Range) instead
// of restarting — important on cellular.
const pausedStates = new Map<MushafVersion, DownloadPauseState>();

const resumeFile = (version: MushafVersion): File =>
  new File(Paths.document, `quran-${version}-resume.json`);

const persistResume = (version: MushafVersion, state: DownloadPauseState): void => {
  pausedStates.set(version, state);
  try {
    const file = resumeFile(version);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(state));
  } catch {
    log.e("Download", `Failed to persist resume state for ${version}`);
  }
};

const readResume = (version: MushafVersion): DownloadPauseState | undefined => {
  const cached = pausedStates.get(version);
  if (cached) return cached;
  try {
    const file = resumeFile(version);
    if (file.exists) return JSON.parse(file.textSync()) as DownloadPauseState;
  } catch {
    log.e("Download", `Failed to read resume state for ${version}`);
  }
  return undefined;
};

const clearResume = (version: MushafVersion): void => {
  pausedStates.delete(version);
  try {
    const file = resumeFile(version);
    if (file.exists) file.delete();
  } catch {
    // best effort
  }
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
  // Light-only: a resumable download captured its pause state (persist it so the
  // transfer continues from the byte offset). Absent → not resumable (dark).
  resumeState?: DownloadPauseState;
  onPaused?: (state: DownloadPauseState) => void;
  // Called when a stored resume state turned out to be unusable and the download
  // restarted fresh, so the caller can drop the persisted state.
  onResumeInvalid?: () => void;
};

// Shared download → extract → zip-cleanup for both the light and dark bundles,
// via a resumable DownloadTask. Returns "extracted" (or already on disk),
// "cancelled", or "paused"; throws on a real download/extract error so the
// caller sets ERROR. The temp zip is kept on pause (resume needs it).
const downloadAndExtractBundle = async (
  active: ActiveDownload,
  opts: BundleDownloadOptions
): Promise<BundleOutcome> => {
  if (opts.alreadyOnDisk) return BundleOutcome.EXTRACTED;

  const zipFile = new File(Paths.cache, opts.zipName);
  let paused = false;
  try {
    opts.emit(DownloadPhase.DOWNLOADING, 0, opts.sizeBytes);
    log.d("Download", `Downloading bundle from ${opts.url}`);

    const taskOptions: DownloadTaskOptions = {
      signal: active.controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        // Server may omit Content-Length (totalBytes === -1); fall back to the
        // size declared in the manifest so the bar still advances.
        const total = totalBytes > 0 ? totalBytes : opts.sizeBytes;
        opts.emit(DownloadPhase.DOWNLOADING, bytesWritten, total);
      },
    };

    // Resolves to the file on completion, or null when pause() was requested.
    // A stored resume state may be stale (its partial gone, or it expired): if
    // resuming throws, fall back to a fresh download rather than failing.
    let file: File | null;
    if (opts.resumeState) {
      try {
        const task = DownloadTask.fromSavable(opts.resumeState, taskOptions);
        active.task = task;
        file = await task.resumeAsync();
      } catch (resumeError) {
        if (active.cancelled) return BundleOutcome.CANCELLED;
        log.e(
          "Download",
          "Resume failed; restarting from scratch",
          resumeError instanceof Error ? resumeError : undefined
        );
        opts.onResumeInvalid?.();
        const task = new DownloadTask(opts.url, zipFile, taskOptions);
        active.task = task;
        file = await task.downloadAsync();
      }
    } else {
      const task = new DownloadTask(opts.url, zipFile, taskOptions);
      active.task = task;
      file = await task.downloadAsync();
    }

    if (active.cancelled) return BundleOutcome.CANCELLED;
    if (file === null) {
      // pause() was requested → capture the resume state before the task is
      // released, keep the partial zip, and report paused.
      paused = true;
      if (active.task) opts.onPaused?.(active.task.savable());
      log.i("Download", "Download paused");
      return BundleOutcome.PAUSED;
    }

    opts.emit(DownloadPhase.EXTRACTING, 0, 0);
    if (!opts.dir.exists) opts.dir.create({ intermediates: true });
    await unzip(zipFile.uri, opts.dir.uri);
    log.d("Download", "Extraction complete");
    if (active.cancelled) return BundleOutcome.CANCELLED;

    if (opts.onExtracted) {
      opts.emit(DownloadPhase.FINALIZING, 0, 0);
      await opts.onExtracted();
    }
    return BundleOutcome.EXTRACTED;
  } finally {
    active.task = undefined;
    // Keep the partial zip when paused (resume continues into it); otherwise
    // remove the transient zip on success, cancel, or error.
    if (!paused && zipFile.exists) zipFile.delete();
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
    const bundleUrl = QuranManifestService.getBundleUrl(manifestVersion);

    // Skip the download if the version is already fully extracted on disk.
    const imageType = detectImageType(version);
    let allPresent = true;
    for (let p = 1; p <= 5; p++) {
      if (!verifyPageOnDisk(version, p, imageType)) {
        allPresent = false;
        break;
      }
    }
    // Already installed → a leftover resume state is meaningless; drop it.
    if (allPresent) clearResume(version);

    // Only resume against the SAME bundle URL — a manifest update invalidates a
    // partial, and resuming it would append mismatched bytes (a broken zip).
    const saved = readResume(version);
    const resumeState = saved && saved.url === bundleUrl ? saved : undefined;
    if (saved && !resumeState) clearResume(version);

    const outcome = await downloadAndExtractBundle(active, {
      url: bundleUrl,
      sizeBytes: QuranManifestService.getBundleSizeBytes(manifestVersion),
      dir: versionDir,
      zipName: `quran-${version}-bundle.zip`,
      alreadyOnDisk: allPresent,
      resumeState,
      emit: (phase, bytes, total) =>
        store.updateDownloadState(version, { progress: buildProgress(phase, bytes, total) }),
      onPaused: (state) => persistResume(version, state),
      onResumeInvalid: () => clearResume(version),
      onExtracted: async () => {
        // Drop any cached bounds connection before swapping the file, so the
        // reader opens the freshly installed geometry. A stale connection (held
        // across the file replacement) reads no glyph bounds — markers don't
        // render and long-press finds nothing — until the app restarts.
        await QuranContentDB.closeBoundsDb(version);

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

    if (active.cancelled || outcome === BundleOutcome.CANCELLED) return;
    if (outcome === BundleOutcome.PAUSED) {
      store.updateDownloadState(version, { status: DownloadStatus.PAUSED });
      return;
    }

    // Bundle downloads are all-or-nothing: a successful extract is completion.
    // The kv-persisted store status and the extracted files on disk are the record.
    clearResume(version);
    store.updateDownloadState(version, { status: DownloadStatus.COMPLETE });
    log.i("Download", `${version} complete`);
  } catch (error) {
    if (active.cancelled) {
      log.i("Download", `${version} download cancelled`);
    } else {
      // A failed transfer/extract leaves no trustworthy partial — drop the
      // resume state so a retry starts fresh rather than resuming a bad zip.
      clearResume(version);
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
    // The dark add-on downloads in the background without a pause/resume UI, so
    // it has no resumeState/onPaused — only EXTRACTED counts as done.
    const outcome = await downloadAndExtractBundle(active, {
      url: darkUrl,
      sizeBytes: QuranManifestService.getDarkBundleSizeBytes(manifestVersion),
      dir: getDarkVersionDir(version),
      zipName: `quran-${version}-dark-bundle.zip`,
      alreadyOnDisk: darkFirstPagePresent(version, imageType),
      emit: (phase, bytes, total) =>
        store.updateDarkDownloadState(version, { progress: buildProgress(phase, bytes, total) }),
    });
    if (active.cancelled || outcome !== BundleOutcome.EXTRACTED) return;

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

const pause = (version: MushafVersion): void => {
  const active = activeDownloads.get(version);
  if (!active?.task) {
    log.d("Download", `No active download to pause for ${version}`);
    return;
  }
  // The active downloadAsync resolves null → doStart records PAUSED and persists
  // the resume state, so the transfer can continue from the byte offset later.
  active.task.pause();
};

// Resume a paused or interrupted download. start() picks up the persisted resume
// state (continuing from the byte offset) or downloads fresh when there is none.
const resume = (version: MushafVersion): Promise<void> => start(version);

const cancel = async (version?: MushafVersion): Promise<void> => {
  const targets = version ? [version] : [...activeDownloads.keys()];
  for (const v of targets) {
    const active = activeDownloads.get(v);
    if (active) {
      active.cancelled = true;
      active.controller.abort();
    }
    // Drop the partial and resume state too — cancel means start over.
    clearResume(v);
    const zip = new File(Paths.cache, `quran-${v}-bundle.zip`);
    if (zip.exists) zip.delete();
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

  // Drop any persisted resume state so it can't resurrect a deleted version.
  clearResume(version);

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

  await QuranContentDB.closeBoundsDb(version);

  const boundsFile = getBoundsDbFile(version);
  if (boundsFile.exists) {
    try {
      boundsFile.delete();
    } catch {
      log.e("Download", `Error deleting bounds-${version}.db`);
    }
  }

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
  deleteVersion,
  checkDiskSpace,
};

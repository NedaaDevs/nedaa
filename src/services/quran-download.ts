import { Directory, DownloadTask, File, Paths } from "expo-file-system";
import type { DownloadPauseState, DownloadTaskOptions } from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import * as SQLite from "expo-sqlite";

import {
  MushafVersion,
  MushafImageType,
  DownloadStatus,
  DownloadPhase,
  DownloadStep,
  BundleOutcome,
  OrnamentAsset,
  OrnamentCategory,
  OrnamentSlot,
} from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE, BUNDLED_ORNAMENT_META } from "@/constants/Quran";
import { ornamentSlotFileName, parseOrnamentPackJson } from "@/utils/quranOrnaments";
import { QuranContentDB } from "@/services/quran-content-db";
import { QuranManifestService } from "@/services/quran-manifest";
import { planEditionDownload, type InstalledVersions } from "@/services/quran-download-plan";
import { useQuranStore } from "@/stores/quran";
import { AppLogger } from "@/utils/appLogger";
import type { DownloadProgress, QuranManifestVersion } from "@/types/quran";

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

const installedFile = (version: MushafVersion): File =>
  new File(Paths.document, `quran-${version}-installed.json`);

const readInstalled = (version: MushafVersion): InstalledVersions => {
  try {
    const file = installedFile(version);
    if (file.exists) return JSON.parse(file.textSync()) as InstalledVersions;
  } catch {
    log.e("Download", `Failed to read installed versions for ${version}`);
  }
  return {};
};

const writeInstalled = (version: MushafVersion, patch: InstalledVersions): void => {
  try {
    const next = { ...readInstalled(version), ...patch };
    const file = installedFile(version);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(next));
  } catch {
    log.e("Download", `Failed to write installed versions for ${version}`);
  }
};

const clearInstalled = (version: MushafVersion): void => {
  try {
    const file = installedFile(version);
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
  step: DownloadStep,
  phase: DownloadPhase,
  bytesDownloaded: number,
  totalBytes: number
): DownloadProgress => {
  const percent =
    totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;
  return { step, phase, bytesDownloaded, totalBytes, percent };
};

const getVersionDir = (version: MushafVersion): Directory => {
  return new Directory(Paths.document, `quran/${version}`);
};

// Where a category's ornament pack lives (readers resolve slot files here,
// falling back to the bundled nedaa art); populated by extracting the
// edition's resolved ornament pack for that category.
const ALL_ORNAMENT_CATEGORIES = Object.values(OrnamentCategory);

const getOrnamentDir = (version: MushafVersion, category: OrnamentCategory): Directory => {
  return new Directory(Paths.document, `quran/${version}/ornaments/${category}`);
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

// Download + extract one category's resolved ornament pack into its dir, when
// absent or out of date. Reads pack.json and pushes the parsed metadata into the
// store. Self-contained + non-fatal — any failure leaves the bundled nedaa
// fallback in place and the edition flow proceeds. `emit` is only supplied by
// the tracked edition download (step 2/2 progress); the opportunistic top-up
// below passes no emitter and reports nothing.
const installOrnamentPack = async (
  active: ActiveDownload,
  version: MushafVersion,
  manifestVersion: QuranManifestVersion,
  category: OrnamentCategory,
  emit: (phase: DownloadPhase, bytesDownloaded: number, totalBytes: number) => void = () => {}
): Promise<void> => {
  const store = useQuranStore.getState();
  try {
    const userChoice = store.ornamentStyle[category];
    const pack = await QuranManifestService.getOrnamentPack(category, manifestVersion, userChoice);
    if (!pack || active.cancelled) return; // no CDN pack → bundled nedaa fallback
    // Record the manifest-resolved style so synchronous renderers pick this
    // edition's pack (not the bundled default) once its files are on disk.
    store.setOrnamentResolved(category, version, pack.styleId);
    const dir = getOrnamentDir(version, category);
    const installedKey = `ornament_${category}`;
    // "Have it" probe: the dark slot of the category's first asset.
    const probeAsset = Object.keys(BUNDLED_ORNAMENT_META[category].assets)[0] as OrnamentAsset;
    const probeFile = new File(dir, ornamentSlotFileName(probeAsset, OrnamentSlot.DARK));
    if (probeFile.exists && readInstalled(version)[installedKey] === pack.version) return;

    const outcome = await downloadAndExtractBundle(active, {
      url: pack.url,
      sizeBytes: 0,
      dir,
      zipName: `quran-${version}-${category}.zip`,
      alreadyOnDisk: false,
      emit,
    });
    if (outcome !== BundleOutcome.EXTRACTED) return;

    writeInstalled(version, { [installedKey]: pack.version });
    const packJson = new File(dir, "pack.json");
    if (packJson.exists) {
      const meta = parseOrnamentPackJson(packJson.textSync());
      if (meta) store.setOrnamentMeta(category, meta);
    }
    log.d("Download", `Installed ${category} pack ${pack.version} for ${version}`);
  } catch (error) {
    log.e(
      "Download",
      `Ornament pack ${category} failed for ${version}`,
      error instanceof Error ? error : undefined
    );
  }
};

// Opportunistic, idempotent ornament fetch for an already-installed edition (the
// edition download covers fresh installs; this catches editions installed before
// a pack existed, or a pack version bump). Cheap: no-ops once the current packs
// are on disk. Runs in its own lightweight context (not a tracked download) so
// it never shows progress chrome.
const ensureOrnamentsInstalled = async (version: MushafVersion): Promise<void> => {
  const manifestVersion = await QuranManifestService.getVersionInfo(version);
  if (!manifestVersion) return;
  const active: ActiveDownload = {
    controller: new AbortController(),
    cancelled: false,
    promise: Promise.resolve(),
  };
  for (const category of ALL_ORNAMENT_CATEGORIES) {
    await installOrnamentPack(active, version, manifestVersion, category);
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

    const imagesUrl = await QuranManifestService.getImagesUrl(manifestVersion);
    const metaUrl = await QuranManifestService.getMetaUrl(manifestVersion);
    if (active.cancelled) return;
    if (!imagesUrl || !metaUrl) {
      log.e("Download", `No images/meta URL for ${version}`);
      store.updateDownloadState(version, { status: DownloadStatus.ERROR });
      return;
    }

    log.i("Download", `Starting download for ${version}`);
    const versionDir = getVersionDir(version);
    const imageType = detectImageType(version);

    // Decide which legs need (re)downloading from the installed vs manifest
    // versions — images and meta/bounds are independently versioned now.
    let imagesOnDisk = true;
    for (let p = 1; p <= 5; p++) {
      if (!verifyPageOnDisk(version, p, imageType)) {
        imagesOnDisk = false;
        break;
      }
    }
    const plan = planEditionDownload(
      readInstalled(version),
      {
        imagesVersion: manifestVersion.images.version,
        metaVersion: manifestVersion.meta.version,
        requiresImages: manifestVersion.meta.requiresImages,
      },
      imagesOnDisk,
      getBoundsDbFile(version).exists
    );

    // Already current → a leftover resume state is meaningless; drop it.
    if (!plan.needImages) clearResume(version);

    // Only resume against the SAME images URL — a version bump changes the URL,
    // and resuming a partial would append mismatched bytes (a broken zip).
    const saved = readResume(version);
    const resumeState = saved && saved.url === imagesUrl ? saved : undefined;
    if (saved && !resumeState) clearResume(version);

    // 1) Images (resumable, ~100MB). The images zip carries no bounds.db.
    const imagesOutcome = await downloadAndExtractBundle(active, {
      url: imagesUrl,
      sizeBytes: QuranManifestService.getImagesSizeBytes(manifestVersion),
      dir: versionDir,
      zipName: `quran-${version}-images.zip`,
      alreadyOnDisk: !plan.needImages,
      resumeState,
      emit: (phase, bytes, total) =>
        store.updateDownloadState(version, {
          progress: buildProgress(DownloadStep.IMAGES, phase, bytes, total),
        }),
      onPaused: (state) => persistResume(version, state),
      onResumeInvalid: () => clearResume(version),
    });
    if (active.cancelled || imagesOutcome === BundleOutcome.CANCELLED) return;
    if (imagesOutcome === BundleOutcome.PAUSED) {
      store.updateDownloadState(version, { status: DownloadStatus.PAUSED });
      return;
    }
    if (plan.needImages) writeInstalled(version, { images: manifestVersion.images.version });

    // 2) Meta/bounds (fresh, ~5MB). bounds.db lives inside, matched to the images.
    const metaOutcome = await downloadAndExtractBundle(active, {
      url: metaUrl,
      sizeBytes: QuranManifestService.getMetaSizeBytes(manifestVersion),
      dir: versionDir,
      zipName: `quran-${version}-meta.zip`,
      alreadyOnDisk: !plan.needMeta,
      emit: (phase, bytes, total) =>
        store.updateDownloadState(version, {
          progress: buildProgress(DownloadStep.IMAGES, phase, bytes, total),
        }),
      onExtracted: async () => {
        // Drop any cached bounds connection before swapping the file, so the
        // reader opens the freshly installed geometry. A stale connection (held
        // across the file replacement) reads no glyph bounds — markers don't
        // render and long-press finds nothing — until the app restarts.
        await QuranContentDB.closeBoundsDb(version);

        const extractedBoundsDb = new File(versionDir, "bounds.db");
        if (extractedBoundsDb.exists) {
          const targetBoundsDb = getBoundsDbFile(version);
          if (targetBoundsDb.exists) targetBoundsDb.delete();
          extractedBoundsDb.move(targetBoundsDb);
          log.d("Download", "Moved bounds.db into place");
        }
      },
    });
    if (active.cancelled || metaOutcome === BundleOutcome.CANCELLED) return;
    if (metaOutcome === BundleOutcome.PAUSED) {
      // Meta is small + non-resumable; treat a pause as "retry later" rather than
      // completing — otherwise the edition lands COMPLETE with bounds.db never
      // moved into place (no markers/highlighting, nothing to re-trigger it).
      store.updateDownloadState(version, { status: DownloadStatus.PAUSED });
      return;
    }
    if (plan.needMeta) writeInstalled(version, { meta: manifestVersion.meta.version });

    // 3) Ornament packs (tiny): the resolved ayah-marker/surah-frame/page-holder
    // packs — step 2/2 of this one visible download job, not a second download.
    // installOrnamentPack declares no sizeBytes for these downloads (a per-pack
    // Content-Length may still arrive over the wire), but the UI intentionally
    // renders no numbers for this step — only the step/phase labels.
    // Non-fatal; failures fall back to the bundled nedaa art.
    store.updateDownloadState(version, {
      progress: buildProgress(DownloadStep.ORNAMENTS, DownloadPhase.DOWNLOADING, 0, 0),
    });
    for (const category of ALL_ORNAMENT_CATEGORIES) {
      // installOrnamentPack's own emit would replay a DOWNLOADING→EXTRACTING
      // cycle per pack, cross-fading the step 2/2 label three times in a row.
      // Leave emit at its no-op default so the single DOWNLOADING phase set
      // above holds for the whole ornament leg.
      await installOrnamentPack(active, version, manifestVersion, category);
    }

    // Complete only once BOTH legs have landed.
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
    const darkUrl = manifestVersion
      ? await QuranManifestService.getImagesUrl(manifestVersion, true)
      : null;
    if (active.cancelled) return;
    if (!manifestVersion || !darkUrl) {
      log.e("Download", `No dark images for ${version}`);
      store.updateDarkDownloadState(version, { status: DownloadStatus.ERROR });
      return;
    }

    const imageType = detectImageType(version);
    // The dark add-on is images-only (bounds are shared with the light edition)
    // and downloads in the background without a pause/resume UI, so it has no
    // resumeState/onPaused — only EXTRACTED counts as done.
    const outcome = await downloadAndExtractBundle(active, {
      url: darkUrl,
      sizeBytes: QuranManifestService.getImagesSizeBytes(manifestVersion, true),
      dir: getDarkVersionDir(version),
      zipName: `quran-${version}-dark-bundle.zip`,
      alreadyOnDisk: darkFirstPagePresent(version, imageType),
      // The dark bundle is a standalone add-on outside the two-step edition job
      // (no ornament leg of its own), so it always reports as the images step.
      emit: (phase, bytes, total) =>
        store.updateDarkDownloadState(version, {
          progress: buildProgress(DownloadStep.IMAGES, phase, bytes, total),
        }),
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
    for (const name of [`quran-${v}-images.zip`, `quran-${v}-meta.zip`]) {
      const zip = new File(Paths.cache, name);
      if (zip.exists) zip.delete();
    }
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

  // Drop any persisted resume state + installed-version markers so they can't
  // resurrect a deleted version.
  clearResume(version);
  clearInstalled(version);

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

// Full reset: drop every edition, wipe the content DB, clear the manifest cache.
// Clearing onboardingComplete routes back to the version picker.
// TODO(quran-gate): remove with the gating scaffolding at 2.10.0.
const resetAll = async (): Promise<void> => {
  for (const version of Object.values(MushafVersion)) {
    await deleteVersion(version);
  }
  await QuranContentDB.wipeContentDb();
  QuranManifestService.clearCache();
  useQuranStore.setState({ selectedVersion: null, onboardingComplete: false });
  log.i("Download", "Reset all Quran data");
};

const checkDiskSpace = (requiredMB: number): { available: boolean; availableMB: number } => {
  try {
    const availableBytes = Paths.availableDiskSpace;
    if (!availableBytes || !Number.isFinite(availableBytes)) {
      return { available: true, availableMB: -1 };
    }
    const availableMB = Math.floor(availableBytes / (1024 * 1024));
    // Fail open: a missing/invalid required size must never block a download —
    // `availableMB >= undefined` is false, which would wrongly report "no space".
    if (!Number.isFinite(requiredMB) || requiredMB <= 0) {
      return { available: true, availableMB };
    }
    return { available: availableMB >= requiredMB, availableMB };
  } catch {
    return { available: true, availableMB: -1 };
  }
};

export const QuranDownload = {
  start,
  ensureOrnamentsInstalled,
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
  resetAll,
  checkDiskSpace,
};

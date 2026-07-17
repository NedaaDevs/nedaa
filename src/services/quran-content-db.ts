import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { File, Directory, Paths, DownloadTask } from "expo-file-system";
import { unzip } from "react-native-zip-archive";

import { QURAN_DB_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { MushafVersion, LineType, SajdaType, RevelationPlace } from "@/enums/quran";
import { GlyphBound, LineMetadata, SurahMeta, AyahMetadata } from "@/types/quran";
import { MutashabihatGroup } from "@/types/mutashabihat";
import { QuranManifestService } from "@/services/quran-manifest";
import { mustDownloadBeforeOpen, needsContentUpdate } from "@/services/quranContentDbStrategy";
import { stripTashkeel } from "@/utils/tashkeel";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-content-db");

// Read-only Quran content: the CDN-downloaded `quran.db` (ayah text + surah/
// division metadata + mutashabihat) and the per-version `bounds-*.db` (glyph
// geometry + line metadata). These connections only read; the transactional
// download-tracking DB lives in `quran-download-db.ts`.

let quranDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
// Synchronous mirror of "the content DB is open and probed", so the reader's gate
// can render ready on the first frame instead of flashing a loader while the
// already-open connection resolves a microtask later.
let quranDbReady = false;
const boundsDbMap = new Map<MushafVersion, Promise<SQLite.SQLiteDatabase>>();

// True once the content DB is open and integrity-probed; false before first open,
// after a failed open, or after a wipe. Drives the reader gate's initial state.
const isContentDbReady = (): boolean => quranDbReady;

// Bounded in-memory cache for per-page reads, so turning or scrubbing back to a
// recently-seen page is instant without re-querying. Keyed by version+page so it
// survives the reader's page-window mount/unmount churn (a per-component cache
// would not). Invalidated when a bounds DB is swapped (closeBoundsDb); quran.db
// is read-only after the one-time copy.
const PAGE_CACHE_LIMIT = 60;
const pageReadCache = new Map<string, unknown>();
// In-flight reads by key, so two callers requesting the same page/ayah on the same
// tick (e.g. useReadAlongWord + useAudioFollowTarget reacting to one ayah change)
// share a single SQLite query instead of issuing a duplicate.
const inflightReads = new Map<string, Promise<unknown>>();
// Bumped on cache clear; a read started before the bump was issued against the
// old DB connection, so its result must not land in the fresh cache.
let cacheGeneration = 0;

const cachedRead = async <T>(key: string, read: () => Promise<T>): Promise<T> => {
  const cached = pageReadCache.get(key);
  if (cached !== undefined) return cached as T;
  const existing = inflightReads.get(key);
  if (existing) return existing as Promise<T>;

  const generation = cacheGeneration;
  const promise = (async () => {
    try {
      const value = await read();
      if (generation === cacheGeneration) {
        if (pageReadCache.size >= PAGE_CACHE_LIMIT) {
          // Map preserves insertion order — evict the oldest entry.
          const oldest = pageReadCache.keys().next().value;
          if (oldest !== undefined) pageReadCache.delete(oldest);
        }
        pageReadCache.set(key, value);
      }
      return value;
    } finally {
      inflightReads.delete(key);
    }
  })();
  inflightReads.set(key, promise);
  return promise;
};

const clearPageReadCache = (): void => {
  pageReadCache.clear();
  // Drop in-flight reads and invalidate their pending results — they were issued
  // against the DB connection being replaced/closed.
  inflightReads.clear();
  cacheGeneration++;
};

const getDirectory = async (): Promise<string> => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }
  return SQLite.defaultDatabaseDirectory;
};

// A background-downloaded update is staged under this name and swapped into place
// on the next open — never over the live connection.
const STAGING_NAME = `${QURAN_DB_NAME}.next`;

type ContentManifest = NonNullable<Awaited<ReturnType<typeof QuranManifestService.getContent>>>;

const getTargetDir = async (): Promise<Directory> => {
  const dir = await getDirectory();
  // On Android, defaultDatabaseDirectory is a plain path, not a file:// URI.
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  const targetDir = new Directory(dirUri);
  if (!targetDir.exists) targetDir.create({ intermediates: true });
  return targetDir;
};

// Download the manifest's content zip and install `quran.db` under `destName`
// (the live name for a first install, the staging name for a background update).
// The version marker is written only after a verified move, so an interrupted
// download is never stamped "installed".
// Correlates concurrent/retried install attempts in logs.
let installSeq = 0;

const installContentDb = async (
  content: ContentManifest,
  targetDir: Directory,
  destName: string
): Promise<void> => {
  const seq = ++installSeq;
  log.i(
    "Content",
    `#${seq} downloading content DB v${content.content.version} → ${destName} (dir=${targetDir.uri})`
  );
  // Cache staging is scoped to destName so a foreground install (quran.db) and a
  // background update (quran.db.next) never share the zip/extract dir — otherwise
  // one's extractDir.delete() yanks the file the other is mid-move(), corrupting
  // the install (java.nio NoSuchFileException).
  const slug = destName.replace(/[^a-zA-Z0-9]/g, "_");
  const zipFile = new File(Paths.cache, `quran-content-${slug}.zip`);
  if (zipFile.exists) zipFile.delete();
  const downloaded = await new DownloadTask(content.url, zipFile).downloadAsync();
  if (!downloaded) throw new Error("[QuranContentDB] content DB download failed");

  const extractDir = new Directory(Paths.cache, `quran-content-${slug}`);
  if (extractDir.exists) extractDir.delete();
  extractDir.create({ intermediates: true });
  await unzip(zipFile.uri, extractDir.uri);

  const extracted = new File(extractDir, QURAN_DB_NAME);
  if (!extracted.exists || extracted.size === 0) {
    throw new Error("[QuranContentDB] content zip missing quran.db");
  }
  log.i("Content", `#${seq} extracted ${extracted.size}B, target dir exists=${targetDir.exists}`);

  const destFile = new File(targetDir, destName);
  const destVersion = new File(targetDir, `${destName}.version`);
  if (destFile.exists) destFile.delete();
  const wal = new File(targetDir, `${destName}-wal`);
  const shm = new File(targetDir, `${destName}-shm`);
  if (wal.exists) wal.delete();
  if (shm.exists) shm.delete();
  extracted.move(destFile);
  log.i(
    "Content",
    `#${seq} moved → dest exists=${destFile.exists} src still exists=${extracted.exists}`
  );

  // Verify the file landed before stamping the version marker — a stamped-but-
  // missing DB is the state that can't self-recover. Existence only: File.size can
  // read null on a freshly-moved handle even when the bytes are present, so it's not
  // a reliable signal here. A truncated/corrupt DB is caught at open by the
  // integrity probe, which triggers the recovery wipe.
  const landed = new File(targetDir, destName);
  if (!landed.exists) {
    // Diagnose where the move actually left things before failing.
    const names = targetDir.exists
      ? targetDir
          .list()
          .map((e) => e.uri.split("/").pop())
          .join(", ")
      : "<target dir missing>";
    log.e(
      "Content",
      `#${seq} landed missing — destFile.exists=${destFile.exists} src=${extracted.exists} target dir: [${names}]`
    );
    throw new Error("[QuranContentDB] content DB missing after install");
  }

  if (destVersion.exists) destVersion.delete();
  destVersion.create();
  destVersion.write(content.content.version);

  zipFile.delete();
  extractDir.delete();
  log.i("Content", `#${seq} installed content DB v${content.content.version} → ${destName}`);
};

// Swap a previously-staged background update into place. Safe to call only before
// the DB is opened (no live connection), so it lives at the top of the open path.
const applyStagedUpdate = (targetDir: Directory): void => {
  const stagedFile = new File(targetDir, STAGING_NAME);
  const stagedVersion = new File(targetDir, `${STAGING_NAME}.version`);
  if (!stagedFile.exists || !stagedVersion.exists) return;

  const targetFile = new File(targetDir, QURAN_DB_NAME);
  const versionFile = new File(targetDir, `${QURAN_DB_NAME}.version`);
  const wal = new File(targetDir, `${QURAN_DB_NAME}-wal`);
  const shm = new File(targetDir, `${QURAN_DB_NAME}-shm`);
  if (targetFile.exists) targetFile.delete();
  if (wal.exists) wal.delete();
  if (shm.exists) shm.delete();
  stagedFile.move(targetFile);

  const version = stagedVersion.textSync();
  if (versionFile.exists) versionFile.delete();
  versionFile.create();
  versionFile.write(version);
  stagedVersion.delete();
  log.i("Content", `Applied staged content DB update v${version}`);
};

// Make sure an openable `quran.db` is installed. When one is already present and
// stamped, open it immediately and leave the manifest/version check to the
// background — so a cold open never waits on the network for a DB it already has.
// Only a genuine first install (or an un-stamped/partial DB) blocks on a download.
const ensureInstalledDbForOpen = async (): Promise<void> => {
  const targetDir = await getTargetDir();
  applyStagedUpdate(targetDir);

  const targetFile = new File(targetDir, QURAN_DB_NAME);
  const versionFile = new File(targetDir, `${QURAN_DB_NAME}.version`);
  const installed = versionFile.exists ? versionFile.textSync() : null;

  if (!mustDownloadBeforeOpen(targetFile.exists, installed)) {
    log.d("Content", `content DB v${installed} present`);
    return;
  }

  const content = await QuranManifestService.getContent();
  if (!content) {
    // Offline with the DB already installed → use it; otherwise fail loudly.
    if (targetFile.exists) {
      log.d("Content", "No manifest; using installed content DB");
      return;
    }
    throw new Error("[QuranContentDB] No content manifest and no installed DB");
  }
  await installContentDb(content, targetDir, QURAN_DB_NAME);
};

let updateCheckInFlight = false;

// Background: compare the installed version against the manifest and, when newer,
// download the new DB to the staging name. It is applied on the next open; the
// live connection is never replaced mid-session.
const checkForContentUpdate = async (): Promise<void> => {
  if (updateCheckInFlight) return;
  updateCheckInFlight = true;
  try {
    const targetDir = await getTargetDir();
    const versionFile = new File(targetDir, `${QURAN_DB_NAME}.version`);
    const installed = versionFile.exists ? versionFile.textSync() : null;

    const content = await QuranManifestService.getContent();
    if (!content || !needsContentUpdate(installed, content.content.version)) return;

    log.i("Content", `Staging background update v${installed} → v${content.content.version}`);
    await installContentDb(content, targetDir, STAGING_NAME);
  } catch (error) {
    log.e("Content", "Background content update failed", error as Error);
  } finally {
    updateCheckInFlight = false;
  }
};

// Delete the given file names under targetDir (missing ones are skipped). Shared
// by the recovery wipe and the full reset.
const removeContentFiles = (targetDir: Directory, names: string[]): void => {
  for (const name of names) {
    const f = new File(targetDir, name);
    if (f.exists) f.delete();
  }
};

// Every file the installed content DB owns — the DB, its version stamp, WAL/SHM,
// and any pending staged update.
const CONTENT_DB_FILES = [
  QURAN_DB_NAME,
  `${QURAN_DB_NAME}.version`,
  `${QURAN_DB_NAME}-wal`,
  `${QURAN_DB_NAME}-shm`,
  STAGING_NAME,
  `${STAGING_NAME}.version`,
];

const openQuranDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!quranDbPromise) {
    quranDbPromise = (async () => {
      try {
        await ensureInstalledDbForOpen();
        const db = await SQLite.openDatabaseAsync(
          QURAN_DB_NAME,
          { useNewConnection: true },
          await getDirectory()
        );
        // Integrity probe: a stamped file can still be truncated/schema-broken.
        // Reading the core `ayahs` table fails the open so the gate shows retry.
        await db.getFirstAsync("SELECT 1 FROM ayahs LIMIT 1");
        quranDbReady = true;
        // Non-blocking: refresh content for the next launch without gating the reader.
        void checkForContentUpdate();
        return db;
      } catch (error) {
        quranDbReady = false;
        log.e("Open", "Error opening quran.db", error as Error);
        // A stamped-but-unopenable DB can't self-heal: mustDownloadBeforeOpen sees
        // the file present + stamped and skips the re-download, so every retry hits
        // the same broken file. Delete the install so the next open re-downloads.
        try {
          const targetDir = await getTargetDir();
          const stamped = new File(targetDir, `${QURAN_DB_NAME}.version`).exists;
          if (stamped) {
            log.w("Open", "recovery wipe begin");
            removeContentFiles(targetDir, CONTENT_DB_FILES);
            log.w("Open", "recovery wipe done — retry re-downloads");
          }
        } catch (cleanupError) {
          log.e("Open", "Recovery wipe failed", cleanupError as Error);
        }
        // Release the single-flight slot only after cleanup, so a concurrent
        // caller can't start a fresh install while the wipe is still deleting.
        quranDbPromise = null;
        throw error;
      }
    })();
  }
  return quranDbPromise;
};

// Wipe the installed content DB (+ version marker / WAL / SHM) and drop the
// in-memory connection. Does not re-download — the next openQuranDb() re-fetches
// behind the reader's DB gate.
// TODO(quran-gate): remove with the gating scaffolding at 2.10.0.
const wipeContentDb = async (): Promise<void> => {
  if (quranDbPromise) {
    try {
      const db = await quranDbPromise;
      await db.closeAsync();
    } catch {
      // already closed or failed to open — we're deleting it regardless
    }
    quranDbPromise = null;
  }
  quranDbReady = false;
  clearPageReadCache();

  const dir = await getDirectory();
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  const targetDir = new Directory(dirUri);
  removeContentFiles(targetDir, CONTENT_DB_FILES);
  log.i("Reset", "Wiped installed content DB");
};

const openBoundsDb = (version: MushafVersion): Promise<SQLite.SQLiteDatabase> => {
  if (!boundsDbMap.has(version)) {
    boundsDbMap.set(
      version,
      (async () => {
        try {
          return await SQLite.openDatabaseAsync(
            `bounds-${version}.db`,
            { useNewConnection: true },
            SQLite.defaultDatabaseDirectory
          );
        } catch (error) {
          boundsDbMap.delete(version);
          log.e("Bounds", `Error opening bounds-${version}.db`, error as Error);
          throw error;
        }
      })()
    );
  }
  return boundsDbMap.get(version)!;
};

const closeBoundsDb = async (version: MushafVersion): Promise<void> => {
  const promise = boundsDbMap.get(version);
  if (promise) {
    try {
      const db = await promise;
      await db.closeAsync();
    } catch {
      // Already closed or failed
    }
    boundsDbMap.delete(version);
  }
  // A bounds DB swap (re-download) can change page geometry — drop cached pages.
  clearPageReadCache();
};

const getLineMetadata = (version: MushafVersion, page: number): Promise<LineMetadata[]> =>
  cachedRead(`lm:${version}:${page}`, async () => {
    const db = await openBoundsDb(version);
    const rows = await db.getAllAsync<{
      page: number;
      line: number;
      type: string;
      surah_number: number | null;
      surah_name: string | null;
    }>("SELECT * FROM line_metadata WHERE page = ? ORDER BY line", [page]);

    return rows.map((row) => ({
      page: row.page,
      line: row.line,
      type: row.type as LineType,
      surahNumber: row.surah_number,
      surahName: row.surah_name,
    }));
  });

const getMarkerBounds = (version: MushafVersion, page: number): Promise<GlyphBound[]> =>
  cachedRead(`mb:${version}:${page}`, async () => {
    const db = await openBoundsDb(version);
    const rows = await db.getAllAsync<{
      page: number;
      line: number;
      position: number;
      surah_number: number;
      ayah_number: number;
      x: number;
      y: number;
      width: number;
      height: number;
      is_marker: number;
      word_index: number | null;
    }>("SELECT * FROM glyph_bounds WHERE page = ? AND is_marker = 1 ORDER BY line, position", [
      page,
    ]);

    return rows.map((row) => ({
      page: row.page,
      line: row.line,
      position: row.position,
      surahNumber: row.surah_number,
      ayahNumber: row.ayah_number,
      wordIndex: row.word_index ?? 0,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      isMarker: true,
    }));
  });

const getGlyphBounds = (version: MushafVersion, page: number): Promise<GlyphBound[]> =>
  cachedRead(`gb:${version}:${page}`, async () => {
    const db = await openBoundsDb(version);
    const rows = await db.getAllAsync<{
      page: number;
      line: number;
      position: number;
      surah_number: number;
      ayah_number: number;
      x: number;
      y: number;
      width: number;
      height: number;
      is_marker: number;
      word_index: number | null;
    }>("SELECT * FROM glyph_bounds WHERE page = ? ORDER BY line, position", [page]);

    return rows.map((row) => ({
      page: row.page,
      line: row.line,
      position: row.position,
      surahNumber: row.surah_number,
      ayahNumber: row.ayah_number,
      wordIndex: row.word_index ?? 0,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      isMarker: row.is_marker === 1,
    }));
  });

// An ayah's word glyphs (no ayah-end marker) in global reading order
// (page → line → position). Each carries its canonical QPC wordIndex — the same
// enumeration the read-along timings use. Cached; spans page boundaries.
const getAyahWordGlyphs = (
  version: MushafVersion,
  surah: number,
  ayah: number
): Promise<GlyphBound[]> =>
  cachedRead(`aw:${version}:${surah}:${ayah}`, async () => {
    const db = await openBoundsDb(version);
    const rows = await db.getAllAsync<{
      page: number;
      line: number;
      position: number;
      surah_number: number;
      ayah_number: number;
      x: number;
      y: number;
      width: number;
      height: number;
      is_marker: number;
      word_index: number | null;
    }>(
      "SELECT * FROM glyph_bounds WHERE surah_number = ? AND ayah_number = ? AND is_marker = 0 ORDER BY page, line, position",
      [surah, ayah]
    );

    // word_index is NULL on schema-0 bounds DBs; the reading-order ordinal is the
    // same enumeration (QPC words never split across glyph rows).
    return rows.map((row, i) => ({
      page: row.page,
      line: row.line,
      position: row.position,
      surahNumber: row.surah_number,
      ayahNumber: row.ayah_number,
      wordIndex: row.word_index ?? i + 1,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      isMarker: row.is_marker === 1,
    }));
  });

const getSurahForPage = async (version: MushafVersion, page: number): Promise<string> => {
  const db = await openBoundsDb(version);
  const result = await db.getFirstAsync<{ surah_name: string }>(
    "SELECT surah_name FROM line_metadata WHERE page = ? AND surah_name IS NOT NULL LIMIT 1",
    [page]
  );
  return result?.surah_name ?? "";
};

const getAyahsForPage = (
  page: number
): Promise<{ surahNumber: number; ayahNumber: number; text: string }[]> =>
  cachedRead(`ay:${page}`, async () => {
    const db = await openQuranDb();
    const rows = await db.getAllAsync<{
      surah_number: number;
      ayah_number: number;
      text: string;
    }>(
      "SELECT surah_number, ayah_number, text FROM ayahs WHERE page = ? ORDER BY surah_number, ayah_number",
      [page]
    );
    return rows.map((row) => ({
      surahNumber: row.surah_number,
      ayahNumber: row.ayah_number,
      text: row.text,
    }));
  });

// One ayah's text + page — powers the long-press action sheet.
const getAyah = async (
  surah: number,
  ayah: number
): Promise<{ text: string; page: number } | null> => {
  const db = await openQuranDb();
  const row = await db.getFirstAsync<{ text: string; page: number }>(
    "SELECT text, page FROM ayahs WHERE surah_number = ? AND ayah_number = ?",
    [surah, ayah]
  );
  return row ?? null;
};

export type AyahSearchHit = {
  surahNumber: number;
  ayahNumber: number;
  page: number;
  text: string;
};

// Build a safe FTS5 MATCH string from raw input: strip tashkeel, fold alef +
// tatweel to match the indexed `text_normalized`, drop anything outside the
// Arabic block / digits (which also strips FTS operators like " * ( OR), then
// quote each token and prefix-match the last.
const buildAyahMatch = (query: string): string | null => {
  const normalized = stripTashkeel(query)
    .replace(/[آأإٱ]/g, "ا") // آأإٱ → ا
    .replace(/ـ/g, "") // tatweel
    .replace(/[^؀-ۿ0-9 ]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((tok, i) => (i === tokens.length - 1 ? `"${tok}"*` : `"${tok}"`)).join(" ");
};

// Full-text verse search over the bundled ayahs_fts (FTS5) index, ranked.
const searchAyahs = async (query: string, limit = 50): Promise<AyahSearchHit[]> => {
  const match = buildAyahMatch(query);
  if (!match) return [];
  const db = await openQuranDb();
  const rows = await db.getAllAsync<{
    surah_number: number;
    ayah_number: number;
    page: number;
    text: string;
  }>(
    `SELECT a.surah_number, a.ayah_number, a.page, a.text
     FROM ayahs_fts f JOIN ayahs a ON a.rowid = f.rowid
     WHERE ayahs_fts MATCH ? ORDER BY rank LIMIT ?`,
    [match, limit]
  );
  return rows.map((r) => ({
    surahNumber: r.surah_number,
    ayahNumber: r.ayah_number,
    page: r.page,
    text: r.text,
  }));
};

const getSurahNameForPageFromContent = async (page: number): Promise<number> => {
  const db = await openQuranDb();
  const result = await db.getFirstAsync<{ surah_number: number }>(
    "SELECT surah_number FROM ayahs WHERE page = ? LIMIT 1",
    [page]
  );
  return result?.surah_number ?? 1;
};

// --- Metadata (surahs + per-ayah divisions) ---

type SurahRow = {
  number: number;
  name_arabic: string;
  name_transliterated: string;
  revelation_place: string;
  revelation_order: number;
  ayah_count: number;
  bismillah_pre: number;
  page_start: number;
  page_end: number;
};

const mapSurah = (row: SurahRow): SurahMeta => ({
  number: row.number,
  nameArabic: row.name_arabic,
  nameTransliterated: row.name_transliterated,
  revelationPlace: row.revelation_place as RevelationPlace,
  revelationOrder: row.revelation_order,
  ayahCount: row.ayah_count,
  bismillahPre: row.bismillah_pre === 1,
  pageStart: row.page_start,
  pageEnd: row.page_end,
});

const getSurah = async (number: number): Promise<SurahMeta | null> => {
  const db = await openQuranDb();
  const row = await db.getFirstAsync<SurahRow>("SELECT * FROM surahs WHERE number = ?", [number]);
  return row ? mapSurah(row) : null;
};

const getAllSurahs = async (): Promise<SurahMeta[]> => {
  const db = await openQuranDb();
  const rows = await db.getAllAsync<SurahRow>("SELECT * FROM surahs ORDER BY number");
  return rows.map(mapSurah);
};

// Start page of each juz / hizb — the first page any ayah of that division
// appears on. Powers the go-to navigation sheet.
const getJuzStartPages = async (): Promise<{ division: number; page: number }[]> => {
  const db = await openQuranDb();
  return db.getAllAsync<{ division: number; page: number }>(
    `SELECT d.juz AS division, MIN(a.page) AS page
     FROM ayah_divisions d
     JOIN ayahs a ON a.surah_number = d.surah AND a.ayah_number = d.ayah
     GROUP BY d.juz ORDER BY d.juz`
  );
};

const getHizbStartPages = async (): Promise<{ division: number; page: number }[]> => {
  const db = await openQuranDb();
  return db.getAllAsync<{ division: number; page: number }>(
    `SELECT d.hizb AS division, MIN(a.page) AS page
     FROM ayah_divisions d
     JOIN ayahs a ON a.surah_number = d.surah AND a.ayah_number = d.ayah
     GROUP BY d.hizb ORDER BY d.hizb`
  );
};

// Start page of each rub (hizb quarter, 1..240) — drives the footer's
// quarter-holder variant on boundary pages.
const getRubStartPages = async (): Promise<{ division: number; page: number }[]> => {
  const db = await openQuranDb();
  return db.getAllAsync<{ division: number; page: number }>(
    `SELECT d.rub AS division, MIN(a.page) AS page
     FROM ayah_divisions d
     JOIN ayahs a ON a.surah_number = d.surah AND a.ayah_number = d.ayah
     GROUP BY d.rub ORDER BY d.rub`
  );
};

// Full metadata for one ayah — powers the press-to-highlight info sheet.
const getAyahMetadata = async (
  surahNumber: number,
  ayahNumber: number
): Promise<AyahMetadata | null> => {
  const db = await openQuranDb();
  const row = await db.getFirstAsync<{
    surah: number;
    ayah: number;
    juz: number;
    hizb: number;
    rub: number;
    manzil: number;
    ruku: number;
    sajda_type: string | null;
    page: number;
    name_arabic: string;
    name_transliterated: string;
  }>(
    `SELECT d.surah, d.ayah, d.juz, d.hizb, d.rub, d.manzil, d.ruku, d.sajda_type,
            a.page, s.name_arabic, s.name_transliterated
     FROM ayah_divisions d
     JOIN surahs s ON s.number = d.surah
     JOIN ayahs  a ON a.surah_number = d.surah AND a.ayah_number = d.ayah
     WHERE d.surah = ? AND d.ayah = ?`,
    [surahNumber, ayahNumber]
  );
  if (!row) return null;
  return {
    surahNumber: row.surah,
    ayahNumber: row.ayah,
    juz: row.juz,
    hizb: row.hizb,
    rub: row.rub,
    manzil: row.manzil,
    ruku: row.ruku,
    sajdaType: (row.sajda_type as SajdaType | null) ?? null,
    page: row.page,
    surahNameArabic: row.name_arabic,
    surahNameTransliterated: row.name_transliterated,
  };
};

const getMutashabihatGroupForAyah = async (
  surah: number,
  ayah: number
): Promise<MutashabihatGroup | null> => {
  const db = await openQuranDb();
  // A verse can sit in several groups; surface the one where its shared phrase is
  // longest (its most significant similarity).
  const links = await db.getAllAsync<{ group_id: string; highlight_spans: string }>(
    "SELECT group_id, highlight_spans FROM mutashabihat_members WHERE surah = ? AND ayah = ?",
    [surah, ayah]
  );
  if (links.length === 0) return null;
  const coverage = (spans: string): number => {
    try {
      return (JSON.parse(spans) as [number, number][]).reduce((n, [f, t]) => n + (t - f + 1), 0);
    } catch {
      return 0;
    }
  };
  const best = links.reduce((a, b) =>
    coverage(b.highlight_spans) > coverage(a.highlight_spans) ? b : a
  );

  const group = await db.getFirstAsync<{
    id: string;
    keyword: string | null;
    rule: string | null;
    show_context: number;
    curated: number;
  }>("SELECT id, keyword, rule, show_context, curated FROM mutashabihat_groups WHERE id = ?", [
    best.group_id,
  ]);
  if (!group) return null;

  const members = await db.getAllAsync<{
    surah: number;
    ayah: number;
    ord: number;
    text: string;
    page: number;
    name_arabic: string;
    name_transliterated: string;
    highlight_spans: string | null;
  }>(
    `SELECT m.surah, m.ayah, m.ord, a.text, a.page,
            s.name_arabic, s.name_transliterated, m.highlight_spans
       FROM mutashabihat_members m
       JOIN ayahs  a ON a.surah_number = m.surah AND a.ayah_number = m.ayah
       JOIN surahs s ON s.number = m.surah
      WHERE m.group_id = ?
      ORDER BY m.ord`,
    [best.group_id]
  );

  return {
    id: group.id,
    keyword: group.keyword,
    rule: group.rule,
    showContext: group.show_context > 0,
    curated: group.curated === 1,
    members: members.map((m) => ({
      surahNumber: m.surah,
      ayahNumber: m.ayah,
      ord: m.ord,
      text: m.text,
      page: m.page,
      surahNameArabic: m.name_arabic,
      surahNameTransliterated: m.name_transliterated,
      highlightSpans: m.highlight_spans
        ? (JSON.parse(m.highlight_spans) as [number, number][])
        : null,
    })),
  };
};

const getMutashabihatKeysForPage = async (page: number): Promise<Set<string>> => {
  const db = await openQuranDb();
  const rows = await db.getAllAsync<{ surah: number; ayah: number }>(
    `SELECT m.surah, m.ayah
       FROM mutashabihat_members m
       JOIN ayahs a ON a.surah_number = m.surah AND a.ayah_number = m.ayah
      WHERE a.page = ?`,
    [page]
  );
  return new Set(rows.map((r) => `${r.surah}:${r.ayah}`));
};

const getTajweedPalette = async (version: MushafVersion): Promise<Map<number, string>> => {
  try {
    const db = await openBoundsDb(version);
    const rows = await db.getAllAsync<{ idx: number; hex: string }>(
      "SELECT idx, hex FROM tajweed_palette"
    );
    return new Map(rows.map((r) => [r.idx, r.hex]));
  } catch {
    // Non-tajweed editions (V1/V2) have no tajweed_palette table.
    return new Map();
  }
};

// Distinct tajweed rules in an ayah, as { CPAL index, hex }, in reading order
// (first occurrence reading down the ayah). Empty for non-tajweed editions
// (V1/V2) or when the edition's bounds aren't installed.
const getAyahTajweed = async (
  version: MushafVersion,
  surah: number,
  ayah: number
): Promise<{ index: number; hex: string }[]> => {
  try {
    const db = await openBoundsDb(version);
    // Reading order = line then position; the per-glyph CSV is already source order.
    const rows = await db.getAllAsync<{ tajweed_index: string }>(
      "SELECT tajweed_index FROM glyph_bounds WHERE surah_number = ? AND ayah_number = ? AND tajweed_index IS NOT NULL AND tajweed_index != '' ORDER BY page, line, position",
      [surah, ayah]
    );
    if (rows.length === 0) return [];
    // Set preserves insertion order → distinct indices in first-occurrence order.
    const indices = new Set<number>();
    for (const r of rows)
      for (const part of r.tajweed_index.split(",")) {
        const n = Number.parseInt(part, 10);
        if (!Number.isNaN(n)) indices.add(n);
      }
    const palette = await getTajweedPalette(version);
    return [...indices].map((index) => ({ index, hex: palette.get(index) ?? "#888888" }));
  } catch (error) {
    log.w("Tajweed", `rule palette lookup failed: ${(error as Error)?.message ?? error}`);
    return [];
  }
};

export const QuranContentDB = {
  openQuranDb,
  isContentDbReady,
  wipeContentDb,
  getMutashabihatGroupForAyah,
  getMutashabihatKeysForPage,
  getAyahTajweed,
  openBoundsDb,
  closeBoundsDb,
  getLineMetadata,
  getGlyphBounds,
  getAyahWordGlyphs,
  getMarkerBounds,
  getSurahForPage,
  getAyahsForPage,
  getAyah,
  searchAyahs,
  getSurahNameForPageFromContent,
  getSurah,
  getAllSurahs,
  getJuzStartPages,
  getHizbStartPages,
  getRubStartPages,
  getAyahMetadata,
};

import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";

import { QURAN_DB_NAME, QURAN_DB_VERSION, QURAN_DOWNLOADS_DB_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import {
  MushafVersion,
  LineType,
  PageDownloadStatus,
  SajdaType,
  RevelationPlace,
} from "@/enums/quran";
import { GlyphBound, LineMetadata, SurahMeta, AyahMetadata } from "@/types/quran";
import { createSerializedDatabase } from "@/utils/serializedDatabase";

let quranDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const boundsDbMap = new Map<MushafVersion, Promise<SQLite.SQLiteDatabase>>();

const getDirectory = async (): Promise<string> => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }
  return SQLite.defaultDatabaseDirectory;
};

// TODO(quran-metadata): TEMPORARY one-time force re-copy of the bundled quran.db.
// The metadata layer (surahs/divisions/sajdas + ayah_divisions view) was added without a
// QURAN_DB_VERSION bump because only the dev device has the old v1 on disk. Flip this true
// once on that device to replace the stale copy, then REMOVE this flag and the `|| FORCE_...`
// guard below. Production installs are unaffected (they copy fresh on first launch).
const FORCE_QURAN_DB_RECOPY = true;

const ensureQuranDbCopied = async (): Promise<void> => {
  const dir = await getDirectory();

  // On Android, defaultDatabaseDirectory is a plain path, not a file:// URI.
  // Convert to URI for expo-file-system compatibility.
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  const targetDir = new Directory(dirUri);
  if (!targetDir.exists) {
    targetDir.create({ intermediates: true });
  }

  const targetFile = new File(targetDir, QURAN_DB_NAME);
  const versionFile = new File(targetDir, `${QURAN_DB_NAME}.version`);

  const installedVersion = versionFile.exists ? versionFile.textSync() : null;
  const needsCopy =
    FORCE_QURAN_DB_RECOPY || !targetFile.exists || installedVersion !== String(QURAN_DB_VERSION);

  if (!needsCopy) return;

  const [asset] = await Asset.loadAsync(require("../../assets/db/quran.db"));
  if (!asset.localUri) {
    throw new Error("[QuranDB] Failed to load quran.db asset");
  }

  // Remove old DB + WAL/SHM before copying new version
  if (targetFile.exists) targetFile.delete();
  const walFile = new File(targetDir, `${QURAN_DB_NAME}-wal`);
  const shmFile = new File(targetDir, `${QURAN_DB_NAME}-shm`);
  if (walFile.exists) walFile.delete();
  if (shmFile.exists) shmFile.delete();

  const sourceFile = new File(asset.localUri);
  sourceFile.copy(targetFile);

  // Write version marker
  if (versionFile.exists) versionFile.delete();
  versionFile.create();
  versionFile.write(String(QURAN_DB_VERSION));

  console.log(`[QuranDB] Copied quran.db v${QURAN_DB_VERSION} to ${dir}`);
};

const openQuranDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!quranDbPromise) {
    quranDbPromise = (async () => {
      try {
        await ensureQuranDbCopied();
        return await SQLite.openDatabaseAsync(
          QURAN_DB_NAME,
          { useNewConnection: true },
          await getDirectory()
        );
      } catch (error) {
        quranDbPromise = null;
        console.error("[QuranDB] Error opening quran.db:", error);
        throw error;
      }
    })();
  }
  return quranDbPromise;
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
          console.error(`[QuranDB] Error opening bounds-${version}.db:`, error);
          throw error;
        }
      })()
    );
  }
  return boundsDbMap.get(version)!;
};

const getLineMetadata = async (version: MushafVersion, page: number): Promise<LineMetadata[]> => {
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
};

const getMarkerBounds = async (version: MushafVersion, page: number): Promise<GlyphBound[]> => {
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
  }>("SELECT * FROM glyph_bounds WHERE page = ? AND is_marker = 1 ORDER BY line, position", [page]);

  return rows.map((row) => ({
    page: row.page,
    line: row.line,
    position: row.position,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    isMarker: true,
  }));
};

const getGlyphBounds = async (version: MushafVersion, page: number): Promise<GlyphBound[]> => {
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
  }>("SELECT * FROM glyph_bounds WHERE page = ? ORDER BY line, position", [page]);

  return rows.map((row) => ({
    page: row.page,
    line: row.line,
    position: row.position,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    isMarker: row.is_marker === 1,
  }));
};

const getJuzForPage = async (page: number): Promise<number> => {
  const db = await openQuranDb();
  // Divisions are stored as boundary tables and resolved per-ayah through the
  // ayah_divisions view. Read the juz off the first ayah on the page.
  const result = await db.getFirstAsync<{ juz: number }>(
    `SELECT d.juz FROM ayahs a
     JOIN ayah_divisions d ON d.surah = a.surah_number AND d.ayah = a.ayah_number
     WHERE a.page = ? LIMIT 1`,
    [page]
  );
  return result?.juz ?? 1;
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

// --- Download tracking ---

// Unlike the read-only quran.db / bounds DBs, this one takes writes and a
// transaction and is polled concurrently while downloading — serialize it.
const downloadSdb = createSerializedDatabase(async () => {
  const db = await SQLite.openDatabaseAsync(
    QURAN_DOWNLOADS_DB_NAME,
    { useNewConnection: true },
    SQLite.defaultDatabaseDirectory
  );
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS quran_downloads (
      version TEXT NOT NULL,
      page INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      size_bytes INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (version, page)
    );
  `);
  return db;
});

const initializeDownloadPages = (version: MushafVersion, totalPages: number): Promise<void> =>
  downloadSdb.run(async (db) => {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (let i = 1; i <= totalPages; i++) {
        await db.runAsync(
          "INSERT OR IGNORE INTO quran_downloads (version, page, status, size_bytes, updated_at) VALUES (?, ?, ?, 0, ?)",
          [version, i, PageDownloadStatus.PENDING, now]
        );
      }
    });
  });

const updatePageStatus = (
  version: MushafVersion,
  page: number,
  status: string,
  sizeBytes?: number
): Promise<void> =>
  downloadSdb.run(async (db) => {
    if (sizeBytes !== undefined) {
      await db.runAsync(
        "UPDATE quran_downloads SET status = ?, size_bytes = ?, updated_at = ? WHERE version = ? AND page = ?",
        [status, sizeBytes, Date.now(), version, page]
      );
    } else {
      await db.runAsync(
        "UPDATE quran_downloads SET status = ?, updated_at = ? WHERE version = ? AND page = ?",
        [status, Date.now(), version, page]
      );
    }
  });

const getPendingPages = (version: MushafVersion, limit: number): Promise<number[]> =>
  downloadSdb.run(async (db) => {
    const rows = await db.getAllAsync<{ page: number }>(
      `SELECT page FROM quran_downloads WHERE version = ? AND status IN ('${PageDownloadStatus.PENDING}', '${PageDownloadStatus.FAILED}') ORDER BY page LIMIT ?`,
      [version, limit]
    );
    return rows.map((r) => r.page);
  });

const getDownloadCounts = (
  version: MushafVersion
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
}> =>
  downloadSdb.run(async (db) => {
    const rows = await db.getAllAsync<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM quran_downloads WHERE version = ? GROUP BY status",
      [version]
    );
    const counts = { total: 0, completed: 0, failed: 0, pending: 0 };
    for (const row of rows) {
      counts.total += row.count;
      if (row.status === PageDownloadStatus.COMPLETE) counts.completed = row.count;
      else if (row.status === PageDownloadStatus.FAILED) counts.failed = row.count;
      else counts.pending += row.count;
    }
    return counts;
  });

const getTotalDownloadedBytes = (version: MushafVersion): Promise<number> =>
  downloadSdb.run(async (db) => {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM quran_downloads WHERE version = ? AND status = '${PageDownloadStatus.COMPLETE}'`,
      [version]
    );
    return result?.total ?? 0;
  });

const isPageComplete = (version: MushafVersion, page: number): Promise<boolean> =>
  downloadSdb.run(async (db) => {
    const result = await db.getFirstAsync<{ status: string }>(
      "SELECT status FROM quran_downloads WHERE version = ? AND page = ?",
      [version, page]
    );
    return result?.status === PageDownloadStatus.COMPLETE;
  });

const deleteVersionDownloads = (version: MushafVersion): Promise<void> =>
  downloadSdb.run(async (db) => {
    await db.runAsync("DELETE FROM quran_downloads WHERE version = ?", [version]);
  });

const resetFailedPages = (version: MushafVersion): Promise<number> =>
  downloadSdb.run(async (db) => {
    const result = await db.runAsync(
      `UPDATE quran_downloads SET status = '${PageDownloadStatus.PENDING}', updated_at = ? WHERE version = ? AND status = '${PageDownloadStatus.FAILED}'`,
      [Date.now(), version]
    );
    return result.changes;
  });

// Bundle download lands the whole DB at once, so flip every page of a version
// to complete in one write (the only download-DB access that lived outside this module).
const markVersionComplete = (version: MushafVersion): Promise<void> =>
  downloadSdb.run(async (db) => {
    await db.runAsync(`UPDATE quran_downloads SET status = ?, updated_at = ? WHERE version = ?`, [
      PageDownloadStatus.COMPLETE,
      Date.now(),
      version,
    ]);
  });

const getSurahForPage = async (version: MushafVersion, page: number): Promise<string> => {
  const db = await openBoundsDb(version);
  const result = await db.getFirstAsync<{ surah_name: string }>(
    "SELECT surah_name FROM line_metadata WHERE page = ? AND surah_name IS NOT NULL LIMIT 1",
    [page]
  );
  return result?.surah_name ?? "";
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
};

const getAyahsForPage = async (
  page: number
): Promise<Array<{ surahNumber: number; ayahNumber: number; text: string }>> => {
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
};

const getSurahNameForPageFromContent = async (page: number): Promise<number> => {
  const db = await openQuranDb();
  const result = await db.getFirstAsync<{ surah_number: number }>(
    "SELECT surah_number FROM ayahs WHERE page = ? LIMIT 1",
    [page]
  );
  return result?.surah_number ?? 1;
};

export const QuranDB = {
  openQuranDb,
  openBoundsDb,
  closeBoundsDb,
  getLineMetadata,
  getGlyphBounds,
  getMarkerBounds,
  getJuzForPage,
  initializeDownloadPages,
  updatePageStatus,
  getPendingPages,
  getDownloadCounts,
  getTotalDownloadedBytes,
  isPageComplete,
  deleteVersionDownloads,
  resetFailedPages,
  markVersionComplete,
  getSurahForPage,
  getAyahsForPage,
  getSurahNameForPageFromContent,
  getSurah,
  getAllSurahs,
  getAyahMetadata,
};

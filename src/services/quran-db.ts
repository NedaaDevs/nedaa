import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";

import { QURAN_DB_NAME, QURAN_DB_VERSION, QURAN_DOWNLOADS_DB_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { MushafVersion, LineType, PageDownloadStatus } from "@/enums/quran";
import { GlyphBound, LineMetadata } from "@/types/quran";

let quranDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const boundsDbMap = new Map<MushafVersion, Promise<SQLite.SQLiteDatabase>>();

const getDirectory = async (): Promise<string> => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }
  return SQLite.defaultDatabaseDirectory;
};

const ensureQuranDbCopied = async (): Promise<void> => {
  const dir = await getDirectory();
  const targetDir = new Directory(dir);
  if (!targetDir.exists) {
    targetDir.create({ intermediates: true });
  }

  const targetFile = new File(targetDir, QURAN_DB_NAME);
  const versionFile = new File(targetDir, `${QURAN_DB_NAME}.version`);

  const installedVersion = versionFile.exists ? versionFile.textSync() : null;
  const needsCopy = !targetFile.exists || installedVersion !== String(QURAN_DB_VERSION);

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
  const result = await db.getFirstAsync<{ juz: number }>(
    "SELECT juz FROM ayahs WHERE page = ? LIMIT 1",
    [page]
  );
  return result?.juz ?? 1;
};

// --- Download tracking ---

let downloadDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const openDownloadDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!downloadDbPromise) {
    downloadDbPromise = (async () => {
      try {
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
      } catch (error) {
        downloadDbPromise = null;
        console.error("[QuranDB] Error opening quran-downloads.db:", error);
        throw error;
      }
    })();
  }
  return downloadDbPromise;
};

const initializeDownloadPages = async (
  version: MushafVersion,
  totalPages: number
): Promise<void> => {
  const db = await openDownloadDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (let i = 1; i <= totalPages; i++) {
      await db.runAsync(
        "INSERT OR IGNORE INTO quran_downloads (version, page, status, size_bytes, updated_at) VALUES (?, ?, ?, 0, ?)",
        [version, i, PageDownloadStatus.PENDING, now]
      );
    }
  });
};

const updatePageStatus = async (
  version: MushafVersion,
  page: number,
  status: string,
  sizeBytes?: number
): Promise<void> => {
  const db = await openDownloadDb();
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
};

const getPendingPages = async (version: MushafVersion, limit: number): Promise<number[]> => {
  const db = await openDownloadDb();
  const rows = await db.getAllAsync<{ page: number }>(
    `SELECT page FROM quran_downloads WHERE version = ? AND status IN ('${PageDownloadStatus.PENDING}', '${PageDownloadStatus.FAILED}') ORDER BY page LIMIT ?`,
    [version, limit]
  );
  return rows.map((r) => r.page);
};

const getDownloadCounts = async (
  version: MushafVersion
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
}> => {
  const db = await openDownloadDb();
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
};

const getTotalDownloadedBytes = async (version: MushafVersion): Promise<number> => {
  const db = await openDownloadDb();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(size_bytes), 0) as total FROM quran_downloads WHERE version = ? AND status = '${PageDownloadStatus.COMPLETE}'`,
    [version]
  );
  return result?.total ?? 0;
};

const isPageComplete = async (version: MushafVersion, page: number): Promise<boolean> => {
  const db = await openDownloadDb();
  const result = await db.getFirstAsync<{ status: string }>(
    "SELECT status FROM quran_downloads WHERE version = ? AND page = ?",
    [version, page]
  );
  return result?.status === PageDownloadStatus.COMPLETE;
};

const deleteVersionDownloads = async (version: MushafVersion): Promise<void> => {
  const db = await openDownloadDb();
  await db.runAsync("DELETE FROM quran_downloads WHERE version = ?", [version]);
};

const resetFailedPages = async (version: MushafVersion): Promise<number> => {
  const db = await openDownloadDb();
  const result = await db.runAsync(
    `UPDATE quran_downloads SET status = '${PageDownloadStatus.PENDING}', updated_at = ? WHERE version = ? AND status = '${PageDownloadStatus.FAILED}'`,
    [Date.now(), version]
  );
  return result.changes;
};

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

export const QuranDB = {
  openQuranDb,
  openBoundsDb,
  closeBoundsDb,
  getLineMetadata,
  getGlyphBounds,
  getMarkerBounds,
  getJuzForPage,
  openDownloadDb,
  initializeDownloadPages,
  updatePageStatus,
  getPendingPages,
  getDownloadCounts,
  getTotalDownloadedBytes,
  isPageComplete,
  deleteVersionDownloads,
  resetFailedPages,
  getSurahForPage,
};

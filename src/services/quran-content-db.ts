import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";

import { QURAN_DB_NAME, QURAN_DB_VERSION } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { MushafVersion, LineType, SajdaType, RevelationPlace } from "@/enums/quran";
import { GlyphBound, LineMetadata, SurahMeta, AyahMetadata } from "@/types/quran";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-content-db");

// Read-only Quran content: the bundled `quran.db` (ayah text + surah/division
// metadata) and the per-version `bounds-*.db` (glyph geometry + line metadata).
// These connections only read; the transactional download-tracking DB lives in
// `quran-download-db.ts`.

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
  const needsCopy = !targetFile.exists || installedVersion !== String(QURAN_DB_VERSION);

  if (!needsCopy) {
    log.d("Copy", `quran.db v${installedVersion} present`);
    return;
  }

  const [asset] = await Asset.loadAsync(require("../../assets/db/quran.db"));
  if (!asset.localUri) {
    throw new Error("[QuranContentDB] Failed to load quran.db asset");
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

  log.i("Copy", `Copied quran.db v${QURAN_DB_VERSION} (${targetFile.size}B)`);
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
        log.e("Open", "Error opening quran.db", error as Error);
        throw error;
      }
    })();
  }
  return quranDbPromise;
};

// Debug: close the connection and delete the copied quran.db (+ marker / WAL /
// SHM) so the next open re-copies the bundled asset. Lets a tester force a fresh
// copy from the debug menu — e.g. to confirm a corrected DB ships in TestFlight.
const resetQuranDb = async (): Promise<void> => {
  if (quranDbPromise) {
    try {
      await (await quranDbPromise).closeAsync();
    } catch {
      // already closed / failed to open
    }
    quranDbPromise = null;
  }

  const dir = await getDirectory();
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  const targetDir = new Directory(dirUri);
  const names = [
    QURAN_DB_NAME,
    `${QURAN_DB_NAME}-wal`,
    `${QURAN_DB_NAME}-shm`,
    `${QURAN_DB_NAME}.version`,
  ];
  for (const name of names) {
    const file = new File(targetDir, name);
    if (file.exists) file.delete();
  }
  log.i("Reset", "Reset quran.db — will re-copy on next open");
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

const getSurahForPage = async (version: MushafVersion, page: number): Promise<string> => {
  const db = await openBoundsDb(version);
  const result = await db.getFirstAsync<{ surah_name: string }>(
    "SELECT surah_name FROM line_metadata WHERE page = ? AND surah_name IS NOT NULL LIMIT 1",
    [page]
  );
  return result?.surah_name ?? "";
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

const getAyahsForPage = async (
  page: number
): Promise<{ surahNumber: number; ayahNumber: number; text: string }[]> => {
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

export const QuranContentDB = {
  openQuranDb,
  resetQuranDb,
  openBoundsDb,
  closeBoundsDb,
  getLineMetadata,
  getGlyphBounds,
  getMarkerBounds,
  getSurahForPage,
  getJuzForPage,
  getAyahsForPage,
  getSurahNameForPageFromContent,
  getSurah,
  getAllSurahs,
  getJuzStartPages,
  getHizbStartPages,
  getAyahMetadata,
};

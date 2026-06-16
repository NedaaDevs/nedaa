import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";

import { QURAN_DB_NAME, QURAN_DB_VERSION } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { MushafVersion, LineType, SajdaType, RevelationPlace } from "@/enums/quran";
import { GlyphBound, LineMetadata, SurahMeta, AyahMetadata } from "@/types/quran";
import { MutashabihatGroup } from "@/types/mutashabihat";
import { stripTashkeel } from "@/utils/tashkeel";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("quran-content-db");

// Read-only Quran content: the bundled `quran.db` (ayah text + surah/division
// metadata) and the per-version `bounds-*.db` (glyph geometry + line metadata).
// These connections only read; the transactional download-tracking DB lives in
// `quran-download-db.ts`.

let quranDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const boundsDbMap = new Map<MushafVersion, Promise<SQLite.SQLiteDatabase>>();

// Bounded in-memory cache for per-page reads, so turning or scrubbing back to a
// recently-seen page is instant without re-querying. Keyed by version+page so it
// survives the reader's page-window mount/unmount churn (a per-component cache
// would not). Invalidated when a bounds DB is swapped (closeBoundsDb); quran.db
// is read-only after the one-time copy.
const PAGE_CACHE_LIMIT = 60;
const pageReadCache = new Map<string, unknown>();

const cachedRead = async <T>(key: string, read: () => Promise<T>): Promise<T> => {
  const cached = pageReadCache.get(key);
  if (cached !== undefined) return cached as T;
  const value = await read();
  if (pageReadCache.size >= PAGE_CACHE_LIMIT) {
    // Map preserves insertion order — evict the oldest entry.
    const oldest = pageReadCache.keys().next().value;
    if (oldest !== undefined) pageReadCache.delete(oldest);
  }
  pageReadCache.set(key, value);
  return value;
};

const clearPageReadCache = (): void => {
  pageReadCache.clear();
};

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
  await sourceFile.copy(targetFile);
  if (targetFile.size === 0) {
    throw new Error("[QuranContentDB] quran.db copy produced an empty file");
  }

  // Version marker is written only after a verified, non-empty copy, so an
  // interrupted copy is never stamped "installed" — leaving needsCopy true so
  // the next open re-copies instead of opening an empty DB forever.
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

// Testing aid: wipe the installed copy of quran.db (+ version marker / WAL / SHM)
// and drop the in-memory connection, then re-copy the bundled DB from scratch.
// Used on TestFlight to pull a changed bundled DB when QURAN_DB_VERSION is unchanged.
// TODO(mutashabihat): remove before public release (along with its Maintenance
// button) — replace with a proper QURAN_DB_VERSION bump for shipping DB changes.
const forceResetQuranDb = async (): Promise<void> => {
  if (quranDbPromise) {
    try {
      const db = await quranDbPromise;
      await db.closeAsync();
    } catch {
      // already closed or failed to open — we're deleting it regardless
    }
    quranDbPromise = null;
  }
  clearPageReadCache();

  const dir = await getDirectory();
  const dirUri = dir.startsWith("file://") ? dir : `file://${dir}`;
  const targetDir = new Directory(dirUri);
  for (const name of [
    QURAN_DB_NAME,
    `${QURAN_DB_NAME}.version`,
    `${QURAN_DB_NAME}-wal`,
    `${QURAN_DB_NAME}-shm`,
  ]) {
    const f = new File(targetDir, name);
    if (f.exists) f.delete();
  }
  log.i("Reset", "Deleted installed quran.db — re-copying bundled DB");

  // Re-copy + re-open now so the caller can use it immediately.
  await openQuranDb();
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
    }>("SELECT * FROM glyph_bounds WHERE page = ? AND is_marker = 1 ORDER BY line, position", [
      page,
    ]);

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

export const QuranContentDB = {
  openQuranDb,
  forceResetQuranDb,
  getMutashabihatGroupForAyah,
  getMutashabihatKeysForPage,
  openBoundsDb,
  closeBoundsDb,
  getLineMetadata,
  getGlyphBounds,
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
  getAyahMetadata,
};

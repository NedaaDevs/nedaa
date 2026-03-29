import * as SQLite from "expo-sqlite";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";

// Constants
import { HISN_MUSLIM_DB_NAME } from "@/constants/DB";

// Services
import { getDirectory } from "@/services/db";

// Types
import type { HisnCategory, HisnAthkar, HisnSearchResult } from "@/types/hisnMuslim";

// Utils
import { stripTashkeel } from "@/utils/tashkeel";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const copyAssetIfNeeded = async (directory: string): Promise<void> => {
  const dbPath = `${directory}/${HISN_MUSLIM_DB_NAME}`;
  const dbFile = new File(dbPath);

  if (dbFile.exists) return;

  const asset = Asset.fromModule(require("../../assets/db/hisn-muslim.db"));
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Failed to download hisn-muslim.db asset");
  }

  const sourceFile = new File(asset.localUri);
  sourceFile.copy(dbFile);
};

const openDatabase = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const directory = await getDirectory();
        await copyAssetIfNeeded(directory);

        return await SQLite.openDatabaseAsync(
          HISN_MUSLIM_DB_NAME,
          {
            useNewConnection: true,
          },
          directory
        );
      } catch (error) {
        dbPromise = null;
        console.error("[HisnMuslim-DB] Error opening database:", error);
        throw error;
      }
    })();
  }
  return dbPromise;
};

const getCategories = async (): Promise<HisnCategory[]> => {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    title_ar: string;
    title_en: string;
    audio_url: string | null;
  }>("SELECT * FROM categories ORDER BY id ASC");

  return rows.map((r) => ({
    id: r.id,
    titleAr: r.title_ar,
    titleEn: r.title_en,
    audioUrl: r.audio_url,
  }));
};

const getCategoryAthkar = async (categoryId: number): Promise<HisnAthkar[]> => {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    category_id: number;
    arabic_text: string;
    transliteration: string;
    translation: string;
    repeat_count: number;
    audio_url: string | null;
    sort_order: number;
  }>("SELECT * FROM athkar WHERE category_id = ? ORDER BY sort_order ASC", [categoryId]);

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    arabicText: r.arabic_text,
    transliteration: r.transliteration,
    translation: r.translation,
    repeatCount: r.repeat_count,
    audioUrl: r.audio_url,
    sortOrder: r.sort_order,
  }));
};

const getAthkarByIds = async (ids: number[]): Promise<HisnAthkar[]> => {
  if (ids.length === 0) return [];
  const db = await openDatabase();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db.getAllAsync<{
    id: number;
    category_id: number;
    arabic_text: string;
    transliteration: string;
    translation: string;
    repeat_count: number;
    audio_url: string | null;
    sort_order: number;
  }>(`SELECT * FROM athkar WHERE id IN (${placeholders})`, ids);

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    arabicText: r.arabic_text,
    transliteration: r.transliteration,
    translation: r.translation,
    repeatCount: r.repeat_count,
    audioUrl: r.audio_url,
    sortOrder: r.sort_order,
  }));
};

const getCategoryForAthkar = async (
  athkarIds: number[]
): Promise<Map<number, { titleAr: string; titleEn: string }>> => {
  if (athkarIds.length === 0) return new Map();
  const db = await openDatabase();
  const placeholders = athkarIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<{
    athkar_id: number;
    title_ar: string;
    title_en: string;
  }>(
    `SELECT a.id as athkar_id, c.title_ar, c.title_en
     FROM athkar a
     JOIN categories c ON c.id = a.category_id
     WHERE a.id IN (${placeholders})`,
    athkarIds
  );

  const map = new Map<number, { titleAr: string; titleEn: string }>();
  for (const r of rows) {
    map.set(r.athkar_id, { titleAr: r.title_ar, titleEn: r.title_en });
  }
  return map;
};

const search = async (query: string): Promise<HisnSearchResult[]> => {
  if (!query.trim()) return [];
  const db = await openDatabase();

  const stripped = stripTashkeel(query.trim());
  const ftsQuery = stripped
    .split(/\s+/)
    .map((word) => `"${word}"*`)
    .join(" ");

  const rows = await db.getAllAsync<{
    id: number;
    category_id: number;
    arabic_text: string;
    transliteration: string;
    translation: string;
    repeat_count: number;
    audio_url: string | null;
    sort_order: number;
    title_ar: string;
    title_en: string;
  }>(
    `SELECT a.*, c.title_ar, c.title_en
     FROM athkar_fts f
     JOIN athkar a ON a.id = f.rowid
     JOIN categories c ON c.id = a.category_id
     WHERE athkar_fts MATCH ?
     ORDER BY rank
     LIMIT 50`,
    [ftsQuery]
  );

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    arabicText: r.arabic_text,
    transliteration: r.transliteration,
    translation: r.translation,
    repeatCount: r.repeat_count,
    audioUrl: r.audio_url,
    sortOrder: r.sort_order,
    categoryTitleAr: r.title_ar,
    categoryTitleEn: r.title_en,
  }));
};

export const HisnMuslimDB = {
  open: openDatabase,
  getCategories,
  getCategoryAthkar,
  getAthkarByIds,
  getCategoryForAthkar,
  search,
};

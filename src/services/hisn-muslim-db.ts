import * as SQLite from "expo-sqlite";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { Asset } from "expo-asset";

// Constants
import { HISN_MUSLIM_DB_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";

// Types
import type { HisnCategory, HisnAthkar, HisnSearchResult } from "@/types/hisnMuslim";

// Enums
import { PlatformType } from "@/enums/app";

// Utils
import { stripTashkeel } from "@/utils/tashkeel";

const HISN_MUSLIM_DB_VERSION = 1;

// Use Paths objects directly — they provide proper file:// URIs on all platforms.
// iOS: app group container (shared with widgets). Android: document directory.
const getDbDirectory = () => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId] ?? Paths.document;
  }
  return Paths.document;
};

const ensureDbCopied = async (): Promise<void> => {
  const targetDir = getDbDirectory();

  const targetFile = new File(targetDir, HISN_MUSLIM_DB_NAME);
  const versionFile = new File(targetDir, `${HISN_MUSLIM_DB_NAME}.version`);

  const installedVersion = versionFile.exists ? versionFile.textSync() : null;
  const needsCopy = !targetFile.exists || installedVersion !== String(HISN_MUSLIM_DB_VERSION);

  if (!needsCopy) return;

  // Remove stale DB + WAL/SHM before copying
  if (targetFile.exists) targetFile.delete();
  const walFile = new File(targetDir, `${HISN_MUSLIM_DB_NAME}-wal`);
  const shmFile = new File(targetDir, `${HISN_MUSLIM_DB_NAME}-shm`);
  if (walFile.exists) walFile.delete();
  if (shmFile.exists) shmFile.delete();

  const [asset] = await Asset.loadAsync(require("../../assets/db/hisn-muslim.db"));
  if (!asset.localUri) {
    throw new Error("[HisnMuslim-DB] Failed to load hisn-muslim.db asset");
  }

  const sourceFile = new File(asset.localUri);
  await sourceFile.copy(targetFile);
  if (targetFile.size === 0) {
    throw new Error("[HisnMuslim-DB] hisn-muslim.db copy produced an empty file");
  }

  // Version marker is written only after a verified, non-empty copy, so an
  // interrupted copy is never stamped "installed" — leaving needsCopy true so
  // the next open re-copies instead of opening an empty DB forever.
  if (versionFile.exists) versionFile.delete();
  versionFile.create();
  versionFile.write(String(HISN_MUSLIM_DB_VERSION));

  console.log(
    `[HisnMuslim-DB] Copied hisn-muslim.db v${HISN_MUSLIM_DB_VERSION} to ${targetDir.uri}`
  );
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const openDatabase = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        await ensureDbCopied();
        return await SQLite.openDatabaseAsync(
          HISN_MUSLIM_DB_NAME,
          { useNewConnection: true },
          getDbDirectory().uri
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

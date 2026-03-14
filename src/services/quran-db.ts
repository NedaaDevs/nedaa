import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { Paths } from "expo-file-system";

import { QURAN_DB_NAME } from "@/constants/DB";
import { appGroupId } from "@/constants/App";
import { PlatformType } from "@/enums/app";
import { MushafVersion, LineType } from "@/enums/quran";
import { GlyphBound, LineMetadata } from "@/types/quran";

let quranDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const boundsDbMap = new Map<MushafVersion, Promise<SQLite.SQLiteDatabase>>();

const getDirectory = async (): Promise<string> => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId]?.uri;
  }
  return SQLite.defaultDatabaseDirectory;
};

const openQuranDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!quranDbPromise) {
    quranDbPromise = (async () => {
      try {
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
            await getDirectory()
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

const getJuzForPage = async (page: number): Promise<number> => {
  const db = await openQuranDb();
  const result = await db.getFirstAsync<{ juz: number }>(
    "SELECT juz FROM ayahs WHERE page = ? LIMIT 1",
    [page]
  );
  return result?.juz ?? 1;
};

export const QuranDB = {
  openQuranDb,
  openBoundsDb,
  getLineMetadata,
  getMarkerBounds,
  getJuzForPage,
};

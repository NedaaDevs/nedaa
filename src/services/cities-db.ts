import * as SQLite from "expo-sqlite";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { Asset } from "expo-asset";

// Constants
import { CITIES_DB_NAME, CITIES_SEED_DB_NAME } from "@/constants/DB";
import { NEAREST_CITY_INITIAL_DEGREES, NEAREST_CITY_MAX_DEGREES } from "@/constants/Cities";
import { appGroupId } from "@/constants/App";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import {
  CitiesTier,
  type CitiesTierValue,
  type CitySearchResult,
  type NearestCity,
} from "@/types/cities";

// Services
import { activeTier } from "@/services/citiesDbStrategy";

// Utils
import { stripTashkeel } from "@/utils/tashkeel";
import { boundingBoxFor } from "@/utils/cities";
import { calculateDistance } from "@/utils/location";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

/** Bump when the bundled seed is regenerated so installed copies are replaced. */
const SEED_VERSION = 1;

// iOS keeps app databases in the shared app-group container so widgets can read them;
// Android has no equivalent, so the document directory is used.
const getDbDirectory = () => {
  if (Platform.OS === PlatformType.IOS) {
    return Paths.appleSharedContainers?.[appGroupId] ?? Paths.document;
  }
  return Paths.document;
};

/**
 * An FTS5 MATCH expression, or null when the query has no searchable content. Every
 * name variant is indexed in one table, so a Latin or Arabic query reaches the same row.
 * Tashkeel is stripped because stored names are unvocalized.
 */
export const buildFtsQuery = (query: string): string | null => {
  const tokens = stripTashkeel(query)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  return tokens.map((word) => `"${word.replace(/"/g, '""')}"*`).join(" ");
};

/** The closest candidate to a point, or null when there are none. */
export const pickNearest = (
  latitude: number,
  longitude: number,
  candidates: CitySearchResult[]
): NearestCity | null => {
  let best: NearestCity | null = null;

  for (const city of candidates) {
    const distanceKm = calculateDistance(latitude, longitude, city.latitude, city.longitude);
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }

  return best;
};

const ensureSeedCopied = async (): Promise<void> => {
  const targetDir = getDbDirectory();
  const targetFile = new File(targetDir, CITIES_SEED_DB_NAME);
  const versionFile = new File(targetDir, `${CITIES_SEED_DB_NAME}.version`);

  const installedVersion = versionFile.exists ? versionFile.textSync() : null;
  if (targetFile.exists && installedVersion === String(SEED_VERSION)) return;

  if (targetFile.exists) targetFile.delete();
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = new File(targetDir, `${CITIES_SEED_DB_NAME}${suffix}`);
    if (sidecar.exists) sidecar.delete();
  }

  const [asset] = await Asset.loadAsync(require("../../assets/db/cities-seed.db"));
  if (!asset.localUri) throw new Error("[Cities-DB] Failed to load cities-seed.db asset");

  await new File(asset.localUri).copy(targetFile);
  if (targetFile.size === 0) {
    throw new Error("[Cities-DB] cities-seed.db copy produced an empty file");
  }

  // The marker is written only after a verified non-empty copy, so an interrupted copy
  // is never stamped installed and the next open re-copies instead.
  if (versionFile.exists) versionFile.delete();
  versionFile.create();
  versionFile.write(String(SEED_VERSION));
  log.i("CitiesDB", `installed seed v${SEED_VERSION}`);
};

export const isFullPackInstalled = (): boolean => {
  const file = new File(getDbDirectory(), CITIES_DB_NAME);
  return file.exists && file.size > 0;
};

export const getInstalledTier = (): CitiesTierValue => activeTier(isFullPackInstalled());

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let openedTier: CitiesTierValue | null = null;

/** Drop the open connection so the next query reopens against the current tier. */
export const invalidateCitiesDb = (): void => {
  const previous = dbPromise;
  dbPromise = null;
  openedTier = null;
  void previous?.then((db) => db.closeAsync()).catch(() => {});
};

const openDatabase = (): Promise<SQLite.SQLiteDatabase> => {
  const tier = getInstalledTier();
  // A finished download changes the tier underneath an open connection.
  if (dbPromise && openedTier !== tier) invalidateCitiesDb();

  if (!dbPromise) {
    openedTier = tier;
    dbPromise = (async () => {
      try {
        if (tier === CitiesTier.SEED) await ensureSeedCopied();
        const name = tier === CitiesTier.FULL ? CITIES_DB_NAME : CITIES_SEED_DB_NAME;
        return await SQLite.openDatabaseAsync(
          name,
          { useNewConnection: true },
          getDbDirectory().uri
        );
      } catch (error) {
        dbPromise = null;
        openedTier = null;
        log.e("CitiesDB", "open failed", error instanceof Error ? error : undefined);
        throw error;
      }
    })();
  }

  return dbPromise;
};

export type CityRow = {
  gid: number;
  name: string;
  lat: number;
  lng: number;
  cc: string;
  pop: number;
  timezone: string;
  country_name: string | null;
  country_ar: string | null;
  country_ur: string | null;
  country_ms: string | null;
  region_code: string | null;
  region_name: string | null;
  region_ar: string | null;
  region_ur: string | null;
  region_ms: string | null;
  name_ar: string | null;
  name_ur: string | null;
  name_ms: string | null;
};

const SELECT_CITY = `
  SELECT c.gid, c.name, c.lat, c.lng, c.cc, c.pop, t.name AS timezone,
         o.name AS country_name, o.name_ar AS country_ar, o.name_ur AS country_ur, o.name_ms AS country_ms,
         a.code AS region_code, a.name AS region_name, a.name_ar AS region_ar, a.name_ur AS region_ur, a.name_ms AS region_ms,
         (SELECT name FROM city_name WHERE gid = c.gid AND lang = 'ar') AS name_ar,
         (SELECT name FROM city_name WHERE gid = c.gid AND lang = 'ur') AS name_ur,
         (SELECT name FROM city_name WHERE gid = c.gid AND lang = 'ms') AS name_ms
  FROM city c
  JOIN tz t ON t.id = c.tz_id
  LEFT JOIN country o ON o.cc = c.cc
  LEFT JOIN admin1 a ON a.cc = c.cc AND a.code = c.admin1
`;

// Country and region are outer-joined so a code the reference tables happen not to
// cover cannot make a city disappear from search results without any error. The tz
// join stays inner because a city with no timezone must never be selectable.
export const toSearchResult = (row: CityRow): CitySearchResult => ({
  gid: row.gid,
  name: row.name,
  names: { ar: row.name_ar, ur: row.name_ur, ms: row.name_ms },
  latitude: row.lat,
  longitude: row.lng,
  countryCode: row.cc,
  country: {
    name: row.country_name ?? row.cc,
    names: { ar: row.country_ar, ur: row.country_ur, ms: row.country_ms },
  },
  region:
    row.region_code && row.region_name
      ? {
          code: row.region_code,
          name: row.region_name,
          names: { ar: row.region_ar, ur: row.region_ur, ms: row.region_ms },
        }
      : null,
  population: row.pop,
  timezone: row.timezone,
});

const searchCities = async (query: string, limit = 40): Promise<CitySearchResult[]> => {
  const match = buildFtsQuery(query);
  if (!match) return [];

  const db = await openDatabase();
  const rows = await db.getAllAsync<CityRow>(
    `${SELECT_CITY}
     WHERE c.gid IN (SELECT gid FROM city_fts WHERE city_fts MATCH ?)
     ORDER BY c.pop DESC
     LIMIT ?`,
    [match, limit]
  );

  return rows.map(toSearchResult);
};

const getCity = async (gid: number): Promise<CitySearchResult | null> => {
  const db = await openDatabase();
  const row = await db.getFirstAsync<CityRow>(`${SELECT_CITY} WHERE c.gid = ?`, [gid]);
  return row ? toSearchResult(row) : null;
};

/**
 * Nearest city to a coordinate, searched in a widening window. Returns null when
 * nothing is found within the widest window, which leaves the caller to obtain a
 * timezone some other way rather than guessing one.
 */
const findNearestCity = async (
  latitude: number,
  longitude: number
): Promise<NearestCity | null> => {
  const db = await openDatabase();

  for (
    let degrees = NEAREST_CITY_INITIAL_DEGREES;
    degrees <= NEAREST_CITY_MAX_DEGREES;
    degrees *= 2
  ) {
    const box = boundingBoxFor(latitude, longitude, degrees);
    const rows = await db.getAllAsync<CityRow>(
      `${SELECT_CITY} WHERE c.lat BETWEEN ? AND ? AND c.lng BETWEEN ? AND ?`,
      [box.minLat, box.maxLat, box.minLng, box.maxLng]
    );
    if (rows.length === 0) continue;

    return pickNearest(latitude, longitude, rows.map(toSearchResult));
  }

  return null;
};

export const CitiesDB = {
  searchCities,
  getCity,
  findNearestCity,
  isFullPackInstalled,
  getInstalledTier,
  invalidate: invalidateCitiesDb,
};

export default CitiesDB;

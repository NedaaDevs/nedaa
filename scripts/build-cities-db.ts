#!/usr/bin/env bun
// Builds the cities databases from the GeoNames dumps.
//
// Two tiers share one schema so the app's query code is tier-agnostic:
//   assets/db/cities-seed.db   the largest cities, bundled in the binary
//   local-data/geonames/cities.db   every city, uploaded to the CDN
//
// Dumps are cached under local-data/geonames (git-excluded) and total ~940MB unpacked.
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { $ } from "bun";

import { CITY_LANGS, type CityLang } from "@/types/cities";
import {
  parseCityLine,
  parseAlternateNameLine,
  pickPreferredName,
  sanitizeName,
  type ParsedCity,
} from "@/utils/geonames";

const DUMP_DIR = "local-data/geonames";
const SEED_DB_PATH = "assets/db/cities-seed.db";
const FULL_DB_PATH = `${DUMP_DIR}/cities.db`;
const SEED_CITY_COUNT = 2500;

// Artifact version, not a data date: bump to v2, v3, … whenever a new pack is uploaded.
// It must match CITIES_PACK_VERSION in src/constants/Cities.ts and the CDN path.
const PACK_VERSION = "v1";

const DUMPS = [
  "cities5000.zip",
  "alternateNamesV2.zip",
  "admin1CodesASCII.txt",
  "countryInfo.txt",
] as const;

const ensureDumps = async () => {
  mkdirSync(DUMP_DIR, { recursive: true });
  for (const file of DUMPS) {
    const target = `${DUMP_DIR}/${file}`;
    const unpacked = target.replace(/\.zip$/, ".txt");
    if (existsSync(unpacked)) continue;

    if (!existsSync(target)) {
      console.log(`downloading ${file}`);
      await $`curl -sSfo ${target} https://download.geonames.org/export/dump/${file}`;
    }
    if (file.endsWith(".zip")) await $`unzip -oq ${target} -d ${DUMP_DIR}`;
  }
};

const createSchema = (db: Database) => {
  db.run(`
    CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE tz(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE country(cc TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT, name_ur TEXT, name_ms TEXT) WITHOUT ROWID;
    CREATE TABLE admin1(cc TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, name_ar TEXT, name_ur TEXT, name_ms TEXT, PRIMARY KEY(cc, code)) WITHOUT ROWID;
    CREATE TABLE city(gid INTEGER PRIMARY KEY, name TEXT NOT NULL, ascii TEXT, lat REAL NOT NULL, lng REAL NOT NULL, cc TEXT NOT NULL, admin1 TEXT, pop INTEGER NOT NULL, tz_id INTEGER NOT NULL REFERENCES tz(id));
    CREATE TABLE city_name(gid INTEGER NOT NULL, lang TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(gid, lang)) WITHOUT ROWID;
    CREATE INDEX idx_city_pop ON city(pop DESC);
    CREATE VIRTUAL TABLE city_fts USING fts5(name, gid UNINDEXED, tokenize='unicode61 remove_diacritics 2');
  `);
};

const readLines = async (path: string): Promise<string[]> =>
  (await Bun.file(path).text()).split("\n");

type NameCandidate = { name: string; isPreferred: boolean };
type LocalizedMap = Map<number, Partial<Record<CityLang, NameCandidate>>>;

/**
 * Localized names for any GeoNames entity — cities, regions and countries all carry a
 * geonameid, so one pass over the 777MB dump serves all three.
 */
const collectLocalizedNames = async (wantedGids: Set<number>): Promise<LocalizedMap> => {
  const out: LocalizedMap = new Map();

  for (const line of await readLines(`${DUMP_DIR}/alternateNamesV2.txt`)) {
    const parsed = parseAlternateNameLine(line);
    if (!parsed || !wantedGids.has(parsed.gid)) continue;

    const entry = out.get(parsed.gid) ?? {};
    const incumbent = entry[parsed.lang];
    entry[parsed.lang] = incumbent
      ? {
          name: pickPreferredName(incumbent, parsed),
          isPreferred: incumbent.isPreferred || parsed.isPreferred,
        }
      : { name: parsed.name, isPreferred: parsed.isPreferred };
    out.set(parsed.gid, entry);
  }

  return out;
};

type Admin1Row = { cc: string; code: string; name: string; gid: number };
type CountryRow = { cc: string; name: string; gid: number };

const readAdmin1 = async (): Promise<Admin1Row[]> => {
  const rows: Admin1Row[] = [];
  for (const line of await readLines(`${DUMP_DIR}/admin1CodesASCII.txt`)) {
    const f = line.split("\t");
    if (f.length < 4) continue;
    const [cc, code] = f[0].split(".");
    const gid = Number(f[3]);
    const name = sanitizeName(f[1] ?? "");
    if (!cc || !code || !name || !Number.isFinite(gid)) continue;
    rows.push({ cc, code, name, gid });
  }
  return rows;
};

const readCountries = async (): Promise<CountryRow[]> => {
  const rows: CountryRow[] = [];
  for (const line of await readLines(`${DUMP_DIR}/countryInfo.txt`)) {
    if (line.startsWith("#") || !line.trim()) continue;
    const f = line.split("\t");
    if (f.length < 17) continue;
    const gid = Number(f[16]);
    const name = sanitizeName(f[4] ?? "");
    if (!f[0] || !name || !Number.isFinite(gid)) continue;
    rows.push({ cc: f[0], name, gid });
  }
  return rows;
};

const build = async (
  outPath: string,
  cityLimit: number | null,
  version: string,
  cities: ParsedCity[],
  admin1Rows: Admin1Row[],
  countryRows: CountryRow[],
  localized: LocalizedMap
) => {
  await $`rm -f ${outPath}`;
  const db = new Database(outPath, { create: true });
  createSchema(db);

  const selected = cityLimit === null ? cities : cities.slice(0, cityLimit);
  const nameFor = (gid: number, lang: CityLang) => localized.get(gid)?.[lang]?.name ?? null;

  const insertTz = db.prepare<{ id: number }, [string]>(
    "INSERT INTO tz(name) VALUES (?) RETURNING id"
  );
  const insertCountry = db.prepare(
    "INSERT INTO country(cc, name, name_ar, name_ur, name_ms) VALUES (?, ?, ?, ?, ?)"
  );
  const insertAdmin1 = db.prepare(
    "INSERT INTO admin1(cc, code, name, name_ar, name_ur, name_ms) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertCity = db.prepare(
    "INSERT INTO city(gid, name, ascii, lat, lng, cc, admin1, pop, tz_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertCityName = db.prepare("INSERT INTO city_name(gid, lang, name) VALUES (?, ?, ?)");
  const insertFts = db.prepare("INSERT INTO city_fts(name, gid) VALUES (?, ?)");
  const insertMeta = db.prepare("INSERT INTO meta(key, value) VALUES (?, ?)");

  const tzIds = new Map<string, number>();
  const timezoneId = (name: string): number => {
    const existing = tzIds.get(name);
    if (existing !== undefined) return existing;

    const id = insertTz.get(name)!.id;
    tzIds.set(name, id);
    return id;
  };

  // Countries a selected city belongs to; the rest would be dead rows in the seed.
  const usedCountries = new Set(selected.map((c) => c.countryCode));

  db.transaction(() => {
    for (const r of countryRows) {
      if (!usedCountries.has(r.cc)) continue;
      insertCountry.run(
        r.cc,
        r.name,
        nameFor(r.gid, "ar"),
        nameFor(r.gid, "ur"),
        nameFor(r.gid, "ms")
      );
    }
    for (const r of admin1Rows) {
      if (!usedCountries.has(r.cc)) continue;
      insertAdmin1.run(
        r.cc,
        r.code,
        r.name,
        nameFor(r.gid, "ar"),
        nameFor(r.gid, "ur"),
        nameFor(r.gid, "ms")
      );
    }

    for (const c of selected) {
      insertCity.run(
        c.gid,
        c.name,
        c.ascii,
        c.latitude,
        c.longitude,
        c.countryCode,
        c.admin1Code,
        c.population,
        timezoneId(c.timezone)
      );
      insertFts.run(c.name, c.gid);
      if (c.ascii) insertFts.run(c.ascii, c.gid);

      for (const lang of CITY_LANGS) {
        const name = nameFor(c.gid, lang);
        if (!name) continue;
        insertCityName.run(c.gid, lang, name);
        insertFts.run(name, c.gid);
      }
    }

    insertMeta.run("tier", cityLimit === null ? "full" : "seed");
    insertMeta.run("version", version);
    insertMeta.run("city_count", String(selected.length));
  })();

  db.run("VACUUM");
  const localizedCount = db.query<{ n: number }, []>("SELECT count(*) AS n FROM city_name").get()!
    .n;
  db.close();

  console.log(`${outPath}: ${selected.length} cities, ${localizedCount} localized names`);
};

await ensureDumps();

console.log("parsing cities");
const cities = (await readLines(`${DUMP_DIR}/cities5000.txt`))
  .map(parseCityLine)
  .filter((c): c is ParsedCity => c !== null)
  .sort((a, b) => b.population - a.population);

const admin1Rows = await readAdmin1();
const countryRows = await readCountries();

console.log("collecting localized names");
const localized = await collectLocalizedNames(
  new Set<number>([
    ...cities.map((c) => c.gid),
    ...admin1Rows.map((r) => r.gid),
    ...countryRows.map((r) => r.gid),
  ])
);

await build(
  SEED_DB_PATH,
  SEED_CITY_COUNT,
  PACK_VERSION,
  cities,
  admin1Rows,
  countryRows,
  localized
);
await build(FULL_DB_PATH, null, PACK_VERSION, cities, admin1Rows, countryRows, localized);
await $`gzip -9kf ${FULL_DB_PATH}`;

console.log(`\nversion ${PACK_VERSION}`);
console.log(`set CITIES_PACK_VERSION in src/constants/Cities.ts to "${PACK_VERSION}"`);
console.log(`upload ${FULL_DB_PATH}.gz to cdn.nedaa.dev/cities/${PACK_VERSION}/cities.db.gz`);
console.log("serve it with Content-Encoding: gzip, or SQLite cannot open the download");

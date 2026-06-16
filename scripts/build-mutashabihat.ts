// Additive build: seed mutashabihat_groups + mutashabihat_members into quran.db.
//
//   1. One-time convert (writes the reviewable seed file):
//        bun scripts/build-mutashabihat.ts --convert /path/to/mutashabiha_data.json
//      → scripts/mutashabihat/groups.json   (COMMIT this)
//   2. Seed (offline, deterministic, from the committed groups.json):
//        bun scripts/build-mutashabihat.ts
//      → assets/db/quran.db.new   (review, then: mv assets/db/quran.db.new assets/db/quran.db)
//
// After committing the new binary, bump QURAN_DB_VERSION (src/constants/DB.ts).
import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { convertWaqar144, type RawData, type SeedGroup } from "./mutashabihat/convert";

const ROOT = join(import.meta.dir, "..");
const DB_SRC = join(ROOT, "assets/db/quran.db");
const DB_OUT = join(ROOT, "assets/db/quran.db.new");
const GROUPS_JSON = join(ROOT, "scripts/mutashabihat/groups.json");

const SCHEMA_SQL = `
CREATE TABLE mutashabihat_groups (
  id           TEXT PRIMARY KEY,            -- content-derived (sorted member keys); stable across re-seeds
  keyword      TEXT,                        -- curated key differing word(s); NULL in v1
  rule         TEXT,                        -- curated mnemonic (our wording); NULL in v1
  show_context INTEGER NOT NULL DEFAULT 0,  -- Waqar144 ctx
  curated      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE mutashabihat_members (
  group_id        TEXT NOT NULL,
  surah           INTEGER NOT NULL,
  ayah            INTEGER NOT NULL,
  ord             INTEGER NOT NULL,
  note            TEXT,                      -- curated per-member note; NULL in v1
  highlight_spans TEXT,                      -- curated JSON word-index array; NULL in v1 (computed diff used)
  PRIMARY KEY (group_id, surah, ayah)
);
CREATE INDEX idx_muts_member ON mutashabihat_members(surah, ayah);
`;

/** Build the absolute→"surah:ayah" map from the ordered ayahs table (standard numbering). */
function buildAbsMap(db: Database): (abs: number) => string | undefined {
  const rows = db
    .query<{ surah_number: number; ayah_number: number }, []>(
      "SELECT surah_number, ayah_number FROM ayahs ORDER BY surah_number, ayah_number"
    )
    .all();
  const map = new Map<number, string>();
  rows.forEach((r, i) => map.set(i + 1, `${r.surah_number}:${r.ayah_number}`));
  return (abs) => map.get(abs);
}

function convertMode(rawPath: string) {
  const db = new Database(DB_SRC, { readonly: true });
  try {
    const absToKey = buildAbsMap(db);
    const raw = JSON.parse(readFileSync(rawPath, "utf8")) as RawData;
    const groups = convertWaqar144(raw, absToKey);
    writeFileSync(GROUPS_JSON, JSON.stringify(groups, null, 1));
    console.log(`Converted ${groups.length} groups -> ${GROUPS_JSON}`);
  } finally {
    db.close();
  }
}

function seed(db: Database, groups: SeedGroup[]) {
  db.exec(SCHEMA_SQL);
  const insG = db.prepare("INSERT INTO mutashabihat_groups (id, show_context) VALUES (?, ?)");
  const insM = db.prepare(
    "INSERT INTO mutashabihat_members (group_id, surah, ayah, ord) VALUES (?, ?, ?, ?)"
  );
  const tx = db.transaction((gs: SeedGroup[]) => {
    for (const g of gs) {
      insG.run(g.id, g.showContext);
      g.members.forEach((key, ord) => {
        const [s, a] = key.split(":").map(Number);
        insM.run(g.id, s, a, ord);
      });
    }
  });
  tx(groups);
}

function verify(db: Database, groups: SeedGroup[]): boolean {
  const scalar = (sql: string) => Object.values(db.query(sql).get() as object)[0] as number | string;
  const checks: Record<string, boolean> = {
    "groups seeded": (scalar("SELECT COUNT(*) FROM mutashabihat_groups") as number) === groups.length,
    "every group has >= 2 members":
      (scalar(
        "SELECT COUNT(*) FROM (SELECT group_id FROM mutashabihat_members GROUP BY group_id HAVING COUNT(*) < 2)"
      ) as number) === 0,
    "every member resolves to a real ayah":
      (scalar(`SELECT COUNT(*) FROM mutashabihat_members m
               LEFT JOIN ayahs a ON a.surah_number = m.surah AND a.ayah_number = m.ayah
               WHERE a.surah_number IS NULL`) as number) === 0,
    integrity_check: scalar("PRAGMA integrity_check") === "ok",
  };
  console.log("\nVerification:");
  let ok = true;
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}`);
    ok &&= passed;
  }
  return ok;
}

function seedMode() {
  if (!existsSync(GROUPS_JSON)) {
    console.error(`ERROR: ${GROUPS_JSON} missing — run with --convert <raw.json> first.`);
    process.exit(1);
  }
  const groups = JSON.parse(readFileSync(GROUPS_JSON, "utf8")) as SeedGroup[];
  copyFileSync(DB_SRC, DB_OUT);
  const db = new Database(DB_OUT, { readwrite: true });
  try {
    seed(db, groups);
    if (verify(db, groups)) console.log(`\nOK -> ${DB_OUT}\nReview, then: mv ${DB_OUT} ${DB_SRC}`);
    else {
      console.log(`\nFAILED — ${DB_OUT} left for inspection.`);
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

const convertArg = process.argv.indexOf("--convert");
if (convertArg !== -1) convertMode(process.argv[convertArg + 1]);
else seedMode();

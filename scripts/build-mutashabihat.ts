// Additive build: seed mutashabihat_groups + mutashabihat_members into quran.db
// from QUL's phrase export (the shared-phrase word spans drive the highlight).
//
//   1. One-time convert (writes the reviewable seed file):
//        bun scripts/build-mutashabihat.ts --convert /path/to/phrases.json
//      → scripts/mutashabihat/groups.json   (COMMIT this)
//   2. Seed (offline, deterministic, from the committed groups.json):
//        bun scripts/build-mutashabihat.ts
//      → assets/db/quran.db.new   (review, then: mv assets/db/quran.db.new assets/db/quran.db)
//
// Data: QUL "Mutashabihat ul Quran" (qul.tarteel.ai/resources/mutashabihat, MIT).
import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { convertQulPhrases, type QulPhrases, type SeedGroup } from "./mutashabihat/convert";

const ROOT = join(import.meta.dir, "..");
const DB_SRC = join(ROOT, "assets/db/quran.db");
const DB_OUT = join(ROOT, "assets/db/quran.db.new");
const GROUPS_JSON = join(ROOT, "scripts/mutashabihat/groups.json");

const SCHEMA_SQL = `
DROP TABLE IF EXISTS mutashabihat_members;
DROP TABLE IF EXISTS mutashabihat_groups;
CREATE TABLE mutashabihat_groups (
  id           TEXT PRIMARY KEY,            -- content-derived (sorted member keys); stable across re-seeds
  keyword      TEXT,                        -- curated key word(s); NULL in v1
  rule         TEXT,                        -- curated mnemonic (our wording); NULL in v1
  show_context INTEGER NOT NULL DEFAULT 0,
  curated      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE mutashabihat_members (
  group_id        TEXT NOT NULL,
  surah           INTEGER NOT NULL,
  ayah            INTEGER NOT NULL,
  ord             INTEGER NOT NULL,
  note            TEXT,                      -- curated per-member note; NULL in v1
  highlight_spans TEXT NOT NULL,             -- JSON [[fromWord,toWord],...] of the shared phrase
  PRIMARY KEY (group_id, surah, ayah)
);
CREATE INDEX idx_muts_member ON mutashabihat_members(surah, ayah);
`;

// QUL matches phrases morphologically, so a "shared" span can have different
// surface words across verses. Keep a group only when its members' shared spans
// are genuinely near-identical: they share >=2 diacritic-stripped words and at
// least half of the smaller span. This drops root-only matches, keeping the
// "differs by a word" mutashabihat the feature is for.
function surfaceCoherent(db: Database, group: SeedGroup): boolean {
  const norm = (w: string) => w.replace(/[^ء-غف-ي]/g, "");
  const tokenSets = group.members.map((m) => {
    const [s, a] = m.key.split(":").map(Number);
    const row = db
      .query<{ text: string }, [number, number]>(
        "SELECT text FROM ayahs WHERE surah_number = ? AND ayah_number = ?"
      )
      .get(s, a);
    const words = (row?.text ?? "").split(/\s+/);
    const toks: string[] = [];
    for (const [from, to] of m.spans)
      for (let i = from; i <= to; i++) if (words[i - 1]) toks.push(norm(words[i - 1]));
    return new Set(toks.filter((x) => x.length > 0));
  });
  let inter = [...tokenSets[0]];
  for (const set of tokenSets.slice(1)) inter = inter.filter((x) => set.has(x));
  const minSize = Math.min(...tokenSets.map((s) => s.size));
  return inter.length >= 2 && inter.length >= 0.5 * minSize;
}

function convertMode(phrasesPath: string) {
  const phrases = JSON.parse(readFileSync(phrasesPath, "utf8")) as QulPhrases;
  const all = convertQulPhrases(phrases);
  const db = new Database(DB_SRC, { readonly: true });
  let groups: SeedGroup[];
  try {
    groups = all.filter((g) => surfaceCoherent(db, g));
  } finally {
    db.close();
  }
  writeFileSync(GROUPS_JSON, JSON.stringify(groups, null, 1));
  console.log(`Converted ${all.length} groups, kept ${groups.length} coherent -> ${GROUPS_JSON}`);
}

function seed(db: Database, groups: SeedGroup[]) {
  db.exec(SCHEMA_SQL);
  const insG = db.prepare("INSERT INTO mutashabihat_groups (id) VALUES (?)");
  const insM = db.prepare(
    "INSERT INTO mutashabihat_members (group_id, surah, ayah, ord, highlight_spans) VALUES (?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((gs: SeedGroup[]) => {
    for (const g of gs) {
      insG.run(g.id);
      g.members.forEach((m, ord) => {
        const [s, a] = m.key.split(":").map(Number);
        insM.run(g.id, s, a, ord, JSON.stringify(m.spans));
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
    "every member has a span": (scalar("SELECT COUNT(*) FROM mutashabihat_members WHERE highlight_spans IS NULL OR highlight_spans = '[]'") as number) === 0,
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
    console.error(`ERROR: ${GROUPS_JSON} missing — run with --convert <phrases.json> first.`);
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

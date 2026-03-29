#!/usr/bin/env bun

/**
 * Builds a SQLite database with FTS5 from athkar.json
 * Output: assets/db/hisn-muslim.db
 *
 * Usage: bun scripts/build-hisn-muslim-db.mjs
 */

import { readFileSync, mkdirSync, existsSync, unlinkSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

const INPUT_PATH = resolve("athkar.json");
const OUTPUT_DIR = resolve("assets/db");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "hisn-muslim.db");

// Arabic tashkeel (diacritics) range: U+0610-U+061A, U+064B-U+065F, U+0670, U+06D6-U+06DC, U+06DF-U+06E4, U+06E7-U+06E8, U+06EA-U+06ED
const TASHKEEL_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g;

function stripTashkeel(text) {
  return text.replace(TASHKEEL_RE, "");
}

function main() {
  console.log("Reading athkar.json...");
  const data = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));

  mkdirSync(OUTPUT_DIR, { recursive: true });
  if (existsSync(OUTPUT_PATH)) unlinkSync(OUTPUT_PATH);

  const db = new Database(OUTPUT_PATH);

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  // ── Schema ───────────────────────────────────────────────

  db.run(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      title_ar TEXT NOT NULL,
      title_en TEXT NOT NULL,
      audio_url TEXT
    )
  `);

  db.run(`
    CREATE TABLE athkar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      arabic_text TEXT NOT NULL,
      transliteration TEXT NOT NULL DEFAULT '',
      translation TEXT NOT NULL DEFAULT '',
      repeat_count INTEGER NOT NULL DEFAULT 1,
      audio_url TEXT,
      sort_order INTEGER NOT NULL
    )
  `);

  db.run("CREATE INDEX idx_athkar_category ON athkar(category_id)");

  // FTS5: we pre-strip Arabic tashkeel before inserting since
  // unicode61 remove_diacritics only handles Latin/Cyrillic marks
  db.run(`
    CREATE VIRTUAL TABLE athkar_fts USING fts5(
      arabic_text,
      translation,
      category_title_ar,
      category_title_en,
      content='',
      contentless_delete=1,
      tokenize='unicode61'
    )
  `);

  // ── Insert data ──────────────────────────────────────────

  const insertCategory = db.prepare(
    "INSERT INTO categories (id, title_ar, title_en, audio_url) VALUES (?, ?, ?, ?)"
  );

  const insertAthkar = db.prepare(
    `INSERT INTO athkar (category_id, arabic_text, transliteration, translation, repeat_count, audio_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertFTS = db.prepare(
    `INSERT INTO athkar_fts (rowid, arabic_text, translation, category_title_ar, category_title_en)
     VALUES (?, ?, ?, ?, ?)`
  );

  let totalAthkar = 0;

  const insertAll = db.transaction(() => {
    for (const cat of data.categories) {
      insertCategory.run(cat.id, cat.titleAr, cat.titleEn, cat.categoryAudioUrl || null);

      for (let i = 0; i < cat.athkar.length; i++) {
        const item = cat.athkar[i];
        insertAthkar.run(
          cat.id,
          item.arabicText,
          item.transliteration || "",
          item.translation || "",
          item.repeat || 1,
          item.audioUrl || null,
          i + 1
        );

        // FTS rowid matches athkar.id (autoincrement)
        // Strip tashkeel from Arabic fields so users can search without diacritics
        totalAthkar++;
        insertFTS.run(
          totalAthkar,
          stripTashkeel(item.arabicText),
          item.translation || "",
          stripTashkeel(cat.titleAr),
          cat.titleEn
        );
      }
    }
  });

  insertAll();

  // ── Verify ───────────────────────────────────────────────

  const catCount = db.prepare("SELECT COUNT(*) as count FROM categories").get();
  const athkarCount = db.prepare("SELECT COUNT(*) as count FROM athkar").get();

  const ftsTest = db.prepare(
    "SELECT rowid, * FROM athkar_fts WHERE athkar_fts MATCH ? LIMIT 3"
  );

  console.log("\n── Verification ─────────────────────────────");
  console.log(`Categories: ${catCount.count}`);
  console.log(`Athkar:     ${athkarCount.count}`);

  const arabicResults = ftsTest.all("الحمد لله");
  console.log(`FTS "الحمد لله": ${arabicResults.length} results`);

  const englishResults = ftsTest.all("praise");
  console.log(`FTS "praise": ${englishResults.length} results`);

  const catResults = ftsTest.all("morning");
  console.log(`FTS "morning": ${catResults.length} results`);

  db.close();

  const fileSize = statSync(OUTPUT_PATH).size;
  console.log(`\nOutput: ${OUTPUT_PATH}`);
  console.log(`Size:   ${(fileSize / 1024).toFixed(1)} KB`);
  console.log("Done.");
}

main();

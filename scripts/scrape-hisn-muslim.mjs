#!/usr/bin/env node

/**
 * Scrapes the HisnMuslim.com API and produces athkar.json + athkar.min.json
 * Usage: node scripts/scrape-hisn-muslim.mjs
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://hisnmuslim.com/api";
const DELAY_MS = 1000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

// ── Helpers ──────────────────────────────────────────────────

function stripBOM(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sanitizeControlChars(text) {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");
}

function sanitizeCategoryDetail(text) {
  // Category 126 has broken JSON: the top-level key is missing its closing quote.
  // Pattern: `"What to say when you feel frightened: \r\n\t[` — should be `"...": [`
  // Fix: find the first `"...: <whitespace> [` and rewrite it as `"...":[`
  return text.replace(
    /^(\{\s*"[^"]*?):\s*[\r\n\t]+\s*\[/,
    '$1":['
  );
}

function decodeHTMLEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanString(str) {
  if (typeof str !== "string") return "";
  return decodeHTMLEntities(str).trim();
}

function toPositiveInt(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url, label, { isDetail = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      let raw = stripBOM(await res.text());
      raw = sanitizeControlChars(raw);
      if (isDetail) raw = sanitizeCategoryDetail(raw);
      return JSON.parse(raw);
    } catch (err) {
      lastError = err;
      console.warn(
        `  [attempt ${attempt}/${MAX_RETRIES}] ${label}: ${err.message}`
      );
      if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastError;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("Fetching Arabic index...");
  const arIndex = await fetchJSON(`${BASE_URL}/ar/husn_ar.json`, "AR index");
  const arCategories = arIndex["العربية"];
  if (!arCategories?.length) {
    console.error("ABORT: Arabic index returned no categories.");
    process.exit(1);
  }
  console.log(`  Found ${arCategories.length} Arabic categories.`);

  console.log("Fetching English index...");
  const enIndex = await fetchJSON(`${BASE_URL}/en/husn_en.json`, "EN index");
  const enCategories = enIndex["English"];
  if (!enCategories?.length) {
    console.error("ABORT: English index returned no categories.");
    process.exit(1);
  }
  console.log(`  Found ${enCategories.length} English categories.`);

  // Build lookup maps by ID
  const arMap = new Map();
  for (const cat of arCategories) {
    arMap.set(cat.ID, {
      titleAr: cleanString(cat.TITLE),
      categoryAudioUrl: cleanString(cat.AUDIO_URL),
    });
  }

  const enMap = new Map();
  for (const cat of enCategories) {
    enMap.set(cat.ID, {
      titleEn: cleanString(cat.TITLE),
    });
  }

  // Collect all unique IDs, sorted ascending
  const allIds = [...new Set([...arMap.keys(), ...enMap.keys()])].sort(
    (a, b) => a - b
  );
  console.log(`\nTotal unique category IDs: ${allIds.length}`);

  // Fetch each category detail
  const categories = [];
  const failedIds = [];
  let totalAthkar = 0;

  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    const ar = arMap.get(id) || { titleAr: "", categoryAudioUrl: "" };
    const en = enMap.get(id) || { titleEn: "" };

    process.stdout.write(
      `  [${i + 1}/${allIds.length}] Fetching category ${id}...`
    );

    let athkar = [];
    try {
      const detail = await fetchJSON(
        `${BASE_URL}/en/${id}.json`,
        `category ${id}`,
        { isDetail: true }
      );
      const key = Object.keys(detail)[0];
      const items = detail[key];

      if (Array.isArray(items)) {
        athkar = items.map((item, idx) => ({
          id: item.ID ?? idx + 1,
          arabicText: cleanString(item.ARABIC_TEXT),
          transliteration: cleanString(item.LANGUAGE_ARABIC_TRANSLATED_TEXT),
          translation: cleanString(item.TRANSLATED_TEXT),
          repeat: toPositiveInt(item.REPEAT),
          audioUrl: cleanString(item.AUDIO),
        }));
      }
      totalAthkar += athkar.length;
      console.log(` ${athkar.length} athkar`);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      failedIds.push(id);
    }

    categories.push({
      id,
      titleAr: ar.titleAr,
      titleEn: en.titleEn,
      categoryAudioUrl: ar.categoryAudioUrl,
      athkar,
    });

    if (i < allIds.length - 1) await sleep(DELAY_MS);
  }

  // Build output
  const output = {
    _meta: {
      source: "hisnmuslim.com/api",
      book: "حصن المسلم من أذكار الكتاب والسنة",
      author: "سعيد بن علي بن وهف القحطاني",
      scrapedAt: new Date().toISOString(),
      totalCategories: categories.length,
      totalAthkar,
    },
    categories,
  };

  // Write files
  const prettyJson = JSON.stringify(output, null, 2);
  const minJson = JSON.stringify(output);

  const prettyPath = resolve("athkar.json");
  const minPath = resolve("athkar.min.json");

  writeFileSync(prettyPath, prettyJson, "utf-8");
  writeFileSync(minPath, minJson, "utf-8");

  // Summary
  console.log("\n── Summary ──────────────────────────────────");
  console.log(`Total categories: ${categories.length}`);
  console.log(`Total athkar:     ${totalAthkar}`);
  console.log(
    `athkar.json:      ${(Buffer.byteLength(prettyJson) / 1024).toFixed(1)} KB`
  );
  console.log(
    `athkar.min.json:  ${(Buffer.byteLength(minJson) / 1024).toFixed(1)} KB`
  );

  if (failedIds.length > 0) {
    console.log(`\nFAILED categories (${failedIds.length}): ${failedIds.join(", ")}`);
  }

  // ── Validation ──────────────────────────────────────────
  console.log("\n── Validation ───────────────────────────────");
  let warnings = 0;

  for (const cat of categories) {
    if (!cat.titleAr) {
      console.warn(`  WARN: Category ${cat.id} has empty titleAr`);
      warnings++;
    }
    if (cat.athkar.length === 0) {
      console.warn(`  WARN: Category ${cat.id} "${cat.titleEn || cat.titleAr}" has 0 athkar`);
      warnings++;
    }

    const seenIds = new Set();
    for (const item of cat.athkar) {
      if (!item.arabicText) {
        console.warn(
          `  WARN: Category ${cat.id}, athkar ${item.id} has empty arabicText`
        );
        warnings++;
      }
      if (seenIds.has(item.id)) {
        console.warn(
          `  WARN: Category ${cat.id} has duplicate athkar ID ${item.id}`
        );
        warnings++;
      }
      seenIds.add(item.id);
      if (item.repeat < 1) {
        console.warn(
          `  WARN: Category ${cat.id}, athkar ${item.id} has repeat=${item.repeat}`
        );
        warnings++;
      }
    }
  }

  const minSizeKB = Buffer.byteLength(minJson) / 1024;
  if (minSizeKB > 1024) {
    console.warn(
      `  WARN: athkar.min.json is ${minSizeKB.toFixed(0)} KB (>1MB) — something may be wrong`
    );
    warnings++;
  }

  if (warnings === 0) {
    console.log("  All checks passed.");
  } else {
    console.log(`  ${warnings} warning(s) found.`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

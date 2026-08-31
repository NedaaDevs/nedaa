import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { FTS_DB_OPEN_OPTIONS } from "@/constants/DB";

// The fault these guard against is native: expo-sqlite finalizes every statement on the
// connection before closing, FTS5 frees the same pointers again on disconnect, and the
// process aborts. Jest cannot reach that, so the invariant is checked at the source level —
// no connection carrying an FTS5 table may open with the finalize sweep enabled.

const SERVICES_DIR = join(__dirname, "..");

const readService = (file: string): string => readFileSync(join(SERVICES_DIR, file), "utf8");

describe("FTS_DB_OPEN_OPTIONS", () => {
  test("disables the close sweep that double-frees FTS5 statements", () => {
    expect(FTS_DB_OPEN_OPTIONS.finalizeUnusedStatementsBeforeClosing).toBe(false);
  });

  test("keeps each connection on its own handle", () => {
    expect(FTS_DB_OPEN_OPTIONS.useNewConnection).toBe(true);
  });
});

describe("FTS5 connections open with the safe options", () => {
  test.each([
    ["cities-db.ts", /openDatabaseAsync\(\s*name,\s*FTS_DB_OPEN_OPTIONS/],
    ["quran-content-db.ts", /openDatabaseAsync\(\s*QURAN_DB_NAME,\s*FTS_DB_OPEN_OPTIONS/],
    ["hisn-muslim-db.ts", /openDatabaseAsync\(\s*HISN_MUSLIM_DB_NAME,\s*FTS_DB_OPEN_OPTIONS/],
  ])("%s passes FTS_DB_OPEN_OPTIONS", (file, pattern) => {
    expect(readService(file as string)).toMatch(pattern as RegExp);
  });

  // Catches a new FTS5-backed service added without the options.
  test("every service that queries an FTS5 table imports the options", () => {
    const offenders = readdirSync(SERVICES_DIR)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => {
        const source = readService(file);
        return /_fts\b/.test(source) && !source.includes("FTS_DB_OPEN_OPTIONS");
      });

    expect(offenders).toEqual([]);
  });
});

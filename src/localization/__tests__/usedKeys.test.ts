import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";

const SOURCE_ROOT = join(process.cwd(), "src");
const SOURCE_FILE = /\.tsx?$/;
const TEST_PATH = /__tests__|test-helpers/;
// A literal dotted key as the first argument of a translate call.
const LITERAL_KEY = /(?<![\w.$])(?:t|i18n\.t|i18next\.t)\(\s*["']([\w-]+(?:\.[\w-]+)+)["']/g;
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
// Arabic alone speaks the time in words, so English has no such keys.
const ARABIC_ONLY_PREFIX = "a11y.time.";

/** Every path a bundle answers, flat or nested; plurals by their base key. */
const pathsOf = (node: object, prefix = ""): string[] =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    const nested = value !== null && typeof value === "object";
    return [path, path.replace(PLURAL_SUFFIX, ""), ...(nested ? pathsOf(value, `${path}.`) : [])];
  });

const EN_PATHS = new Set(pathsOf(en));
const AR_PATHS = new Set(pathsOf(ar));

const resolves = (key: string): boolean =>
  key.startsWith(ARABIC_ONLY_PREFIX) ? AR_PATHS.has(key) : EN_PATHS.has(key);

const sourceFiles = (): string[] =>
  readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
    .filter((path) => SOURCE_FILE.test(path) && !TEST_PATH.test(path))
    .map((path) => join(SOURCE_ROOT, path));

describe("translation keys in the source", () => {
  it("resolves each literal key, so nobody reads a raw key", () => {
    const missing = sourceFiles().flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(LITERAL_KEY)]
        .map(([, key]) => key)
        .filter((key) => !resolves(key))
    );
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it("finds keys in the source", () => {
    const found = sourceFiles().flatMap((file) => [
      ...readFileSync(file, "utf8").matchAll(LITERAL_KEY),
    ]);
    expect(found.length).toBeGreaterThan(1000);
  });

  // A base key resolves on any one form, so a missing form needs its own check.
  it("has each English plural form of each plural key", () => {
    const { pluralCategories } = new Intl.PluralRules("en").resolvedOptions();
    const bases = [...EN_PATHS].filter((path) => PLURAL_SUFFIX.test(path));
    const missing = bases
      .map((path) => path.replace(PLURAL_SUFFIX, ""))
      .flatMap((base) => pluralCategories.map((form) => `${base}_${form}`))
      .filter((path) => !EN_PATHS.has(path));
    expect([...new Set(missing)].sort()).toEqual([]);
  });
});

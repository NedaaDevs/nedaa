import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";

const SOURCE_ROOT = join(process.cwd(), "src");
const SOURCE_FILE = /\.tsx?$/;
const TEST_PATH = /__tests__|test-helpers/;
// A literal key, dotted or not, as the first argument of a translate call,
// and whether the call's inline options set `returnObjects: true`.
const LITERAL_KEY =
  /(?<![\w.$])(?:t|i18n\.t|i18next\.t)\(\s*["']([\w-]+(?:\.[\w-]+)*)["'](?:\s*,\s*\{[^}]*\b(returnObjects):\s*true)?/g;
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
// Arabic alone speaks the time in words, so English has no such keys.
const ARABIC_ONLY_PREFIX = "a11y.time.";
// `headerJuzLabel` writes the Arabic label from its own ordinals.
const ENGLISH_ONLY_KEY = "quran.header.partLabel";

const isObject = (value: unknown): value is object => value !== null && typeof value === "object";

/** Every path that holds text, flat or nested; plurals also by base key. */
const textPathsOf = (node: object, prefix = ""): string[] =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    return isObject(value)
      ? textPathsOf(value, `${path}.`)
      : [path, path.replace(PLURAL_SUFFIX, "")];
  });

/** Every path that holds an object; only `returnObjects` can read one. */
const objectPathsOf = (node: object, prefix = ""): string[] =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    return isObject(value) ? [path, ...objectPathsOf(value, `${path}.`)] : [];
  });

const EN_PATHS = new Set(textPathsOf(en));
const AR_PATHS = new Set(textPathsOf(ar));
const EN_OBJECTS = new Set(objectPathsOf(en));
const AR_OBJECTS = new Set(objectPathsOf(ar));

const resolves = (key: string, wantsObject: boolean): boolean => {
  const [enPaths, arPaths] = wantsObject ? [EN_OBJECTS, AR_OBJECTS] : [EN_PATHS, AR_PATHS];
  if (key.startsWith(ARABIC_ONLY_PREFIX)) return arPaths.has(key);
  if (key === ENGLISH_ONLY_KEY) return enPaths.has(key);
  return enPaths.has(key) && arPaths.has(key);
};

const sourceFiles = (): string[] =>
  readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
    .filter((path) => SOURCE_FILE.test(path) && !TEST_PATH.test(path))
    .map((path) => join(SOURCE_ROOT, path));

describe("translation keys in the source", () => {
  it("resolves each literal key, so nobody reads a raw key", () => {
    const missing = sourceFiles().flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(LITERAL_KEY)]
        .filter(([, key, returnObjects]) => !resolves(key, returnObjects !== undefined))
        .map(([, key]) => key)
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

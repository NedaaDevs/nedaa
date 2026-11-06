import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";

import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";

/**
 * A face name written into a component picks a script, not a weight, so Arabic
 * text under a Latin face falls to an OS substitute with no error.
 * `useFontFamily(weight)` resolves the face from the locale instead.
 */
const FACE_LITERAL = /["'](IBMPlexSans(?:Arabic)?-(?:Regular|Medium|SemiBold|Bold))["']/g;

/** The font wiring itself must name the faces. */
const ALLOWED = ["src/config/fonts.ts", "src/constants/Fonts.ts"];

/**
 * Files whose text is Arabic by content rather than by locale, so the face is
 * fixed. The reason is re-proved below; an entry here suppresses nothing.
 */
const ARABIC_BY_CONTENT: Record<string, string> = {
  "src/app/alarm-complete.tsx": "MORNING_DHIKR_AR",
};

const offenders = () =>
  walkFiles(`${REPO_ROOT}${sep}src`)
    .filter((path) => /\.tsx?$/.test(path) && !path.split(sep).includes("__tests__"))
    .map((path) => ({
      file: relative(REPO_ROOT, path).split(sep).join("/"),
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ file }) => !ALLOWED.includes(file) && !(file in ARABIC_BY_CONTENT))
    .flatMap(({ file, source }) =>
      [...source.matchAll(FACE_LITERAL)].map((m) => `${file}: ${m[1]}`)
    );

describe("font face literals", () => {
  it("scans the tree", () => {
    const scanned = walkFiles(`${REPO_ROOT}${sep}src`).filter((p) => /\.tsx?$/.test(p));

    expect(scanned.length).toBeGreaterThan(200);
  });

  it("names a face only where the fonts are wired", () => {
    expect(offenders()).toEqual([]);
  });

  it.each(Object.entries(ARABIC_BY_CONTENT))(
    "%s holds Arabic whatever the locale",
    (file, symbol) => {
      const source = readFileSync(`${REPO_ROOT}${sep}${file.split("/").join(sep)}`, "utf8");
      const literal = source.match(new RegExp(`const ${symbol} = "([^"]+)"`));
      if (!literal) throw new Error(`${symbol} not found in ${file}`);

      expect(literal[1]).toMatch(/[\u0600-\u06FF]/);
      expect(source).toMatch(/IBMPlexSansArabic-/);
    }
  );
});

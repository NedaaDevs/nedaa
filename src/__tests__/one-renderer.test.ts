import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const SRC = join(__dirname, "..");

/** Every source file under src/, tests excluded. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });

// A value two screens show must look and move alike, so it has one renderer:
// each row names what marks a file showing it, and the component it must use.
const ONE_RENDERER = [
  { concept: "a prayer's count figure", shows: /\bformatCount\(/, drawsWith: /<Countdown\b/ },
] as const;

const FILES = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe.each(ONE_RENDERER)("$concept", ({ shows, drawsWith }) => {
  const showing = FILES.filter(({ text }) => shows.test(text));

  it("is shown somewhere, so this rule still guards something", () => {
    expect(showing.length).toBeGreaterThan(0);
  });

  it("is drawn by its one renderer wherever it is shown", () => {
    expect(showing.filter(({ text }) => !drawsWith.test(text)).map(({ path }) => path)).toEqual([]);
  });
});

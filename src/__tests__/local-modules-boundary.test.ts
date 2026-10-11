import fs from "node:fs";
import path from "node:path";

const MODULES_DIR = path.resolve(__dirname, "../../modules");
const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
const APP_ALIAS_IMPORT = /(?:from\s+|require\(\s*|import\(\s*)["']@\//;

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });

const moduleSources = fs
  .readdirSync(MODULES_DIR)
  .map((name) => path.join(MODULES_DIR, name, "src"))
  .filter((dir) => fs.existsSync(dir))
  .flatMap(sourceFiles);

// bun copies modules into node_modules, where Metro has no `@/` alias.
it("keeps every local module free of app-alias imports", () => {
  const offenders = moduleSources
    .filter((file) => APP_ALIAS_IMPORT.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(MODULES_DIR, file));

  expect(moduleSources.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});

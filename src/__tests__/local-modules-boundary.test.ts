import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const MODULES_DIR = path.resolve(__dirname, "../../modules");
const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
const APP_ALIAS = "@/";

// The compiler's own scanner sees every import, require and dynamic import form.
const importsAppAlias = (source: string): boolean =>
  ts
    .preProcessFile(source, true, true)
    .importedFiles.some(({ fileName }) => fileName.startsWith(APP_ALIAS));

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
    .filter((file) => importsAppAlias(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(MODULES_DIR, file));

  expect(moduleSources.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});

it.each([
  'import a from "@/a";',
  'import "@/b";',
  'const c = require("@/c");',
  'import ("@/d");',
  "const e = import(`@/e`);",
  'export * from "@/f";',
  'import type { G } from "@/g";',
])("flags the app alias in %s", (source) => {
  expect(importsAppAlias(source)).toBe(true);
});

it("passes a module that imports only packages and relative files", () => {
  expect(importsAppAlias('import { Platform } from "react-native";\nimport x from "./x";')).toBe(
    false
  );
});

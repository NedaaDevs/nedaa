import { readFileSync } from "fs";
import { dirname, join, relative, resolve, sep } from "path";
import ts from "typescript";

import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";

const COMPONENTS_DIR = join(REPO_ROOT, "src", "components");
const UI_DIR = join(COMPONENTS_DIR, "ui");
const COMPONENTS_ALIAS = "@/components/";
const TEST_DIR = "__tests__";
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;

const REQUIRE = "require";

/** The module a node names: an import, export, require or import() of it. */
const moduleOf = (node: ts.Node): ts.Node | undefined => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return node.moduleReference.expression;
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return node.argument.literal;
  }
  const loads =
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === REQUIRE));
  return loads ? node.arguments[0] : undefined;
};

/** Every module a file imports, re-exports, requires or loads, as written. */
const specifiersOf = (path: string, source: string) => {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const named = moduleOf(node);
    if (named && ts.isStringLiteralLike(named)) found.push(named.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest));
  return found;
};

/** Where a specifier points on disk; null for a package. */
const targetOf = (file: string, specifier: string) => {
  if (specifier.startsWith(COMPONENTS_ALIAS)) {
    return join(COMPONENTS_DIR, specifier.slice(COMPONENTS_ALIAS.length));
  }
  return specifier.startsWith(".") ? resolve(dirname(file), specifier) : null;
};

/** A component outside the design system, which ui must never reach. */
const leavesUi = (file: string, specifier: string) => {
  const target = targetOf(file, specifier);
  if (target === null) return false;
  const fromComponents = relative(COMPONENTS_DIR, target);
  const fromUi = relative(UI_DIR, target);
  const inComponents = !fromComponents.startsWith("..");
  return inComponents && (fromUi === ".." || fromUi.startsWith(`..${sep}`));
};

const isTest = (path: string) =>
  TEST_FILE.test(path) || relative(UI_DIR, path).split(sep).includes(TEST_DIR);

// Screens build on ui; a ui part built on a screen part would turn that around.
describe("the ui boundary", () => {
  const files = walkFiles(UI_DIR).filter((path) => SOURCE_FILE.test(path) && !isTest(path));

  it("reads the design system's source", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each([
    ['import { A } from "@/components/today/A";', true],
    ['export { B } from "@/components/settings/B";', true],
    ['const c = require("@/components/onboarding/C");', true],
    ['import type { D } from "@/components/location/D";', true],
    ['import { E } from "../../today/E";', true],
    ['export * as K from "@/components/today/K";', true],
    ['export type * as L from "@/components/today/L";', true],
    ['const m = import("@/components/today/M");', true],
    ['type N = import("@/components/today/N").N;', true],
    ['import O = require("@/components/today/O");', true],
    ['const quote = /"/; const p = require("@/components/today/P");', true],
    ['import { F } from "@/components/ui/box";', false],
    ['import { G } from "../text";', false],
    ['import { H } from "@/constants/Accessibility";', false],
    ['import { I } from "react-native";', false],
    ['// import { J } from "@/components/today/J";', false],
  ])("%s leaves ui: %s", (source, expected) => {
    const file = join(UI_DIR, "probe", "index.tsx");
    expect(specifiersOf(file, source).some((specifier) => leavesUi(file, specifier))).toBe(
      expected
    );
  });

  it("imports no component outside ui", () => {
    const leaks = files.flatMap((path) =>
      specifiersOf(path, readFileSync(path, "utf8"))
        .filter((specifier) => leavesUi(path, specifier))
        .map((specifier) => `${relative(REPO_ROOT, path)} → ${specifier}`)
    );

    expect(leaks).toEqual([]);
  });
});

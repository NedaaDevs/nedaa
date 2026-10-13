import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const ESLINT_BIN = path.join(REPO_ROOT, "node_modules/.bin/eslint");
// A path inside a local module, so the module override applies.
const MODULE_FILE = "modules/expo-widget/src/__boundary.ts";
const BOUNDARY_RULES = new Set(["no-restricted-imports", "no-restricted-syntax"]);

const REJECTED = [
  'import a from "@/a";',
  'import "@/b";',
  'import type { G } from "@/g";',
  'export * from "@/f";',
  'export { h } from "@/h";',
  'const c = require("@/c");',
  'const d = import("@/d");',
  "const e = import(`@/e/${n}`);",
  "const r = require(`@/r/${n}`);",
];
const ACCEPTED = ['import { Platform } from "react-native";', 'import x from "./x";'];

type LintMessage = { line: number; ruleId: string | null };

// ESLint loads its config with import(), which Jest's VM cannot run.
const flaggedLines = (source: string): Set<number> => {
  let output: string;
  try {
    output = execFileSync(
      ESLINT_BIN,
      ["--stdin", "--stdin-filename", MODULE_FILE, "--format", "json"],
      { cwd: REPO_ROOT, input: source, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    );
  } catch (error) {
    // ESLint exits 1 when it reports errors; its JSON is still on stdout.
    output = String((error as { stdout?: string }).stdout ?? "[]");
  }
  return lintedLines(output);
};

const lintedLines = (output: string): Set<number> => {
  const [result] = JSON.parse(output) as [{ messages: LintMessage[] }];
  return new Set(
    result.messages
      .filter((message) => BOUNDARY_RULES.has(message.ruleId ?? ""))
      .map((message) => message.line)
  );
};

// bun copies modules into node_modules, where Metro has no `@/` alias.
describe("the local-module lint boundary", () => {
  // Line 1 declares `n`; each form then sits on its own line.
  const lines = ["const n = 'x';", ...REJECTED, ...ACCEPTED];
  let flagged: Set<number>;

  beforeAll(() => {
    flagged = flaggedLines(lines.join("\n"));
  }, 60_000);

  it.each(REJECTED.map((source, index) => [source, index + 2] as const))(
    "rejects %s",
    (_source, line) => {
      expect(flagged.has(line)).toBe(true);
    }
  );

  it("accepts packages and relative files", () => {
    const firstAccepted = REJECTED.length + 2;
    ACCEPTED.forEach((_source, index) => expect(flagged.has(firstAccepted + index)).toBe(false));
  });
});

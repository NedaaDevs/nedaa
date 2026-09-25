import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";

import { REPO_ROOT } from "@/test-helpers/routeTree";

// bun applies a patch only to the exact version its key names, so a version
// bump leaves the patch unapplied. These checks make that bump fail.

const MANIFEST = "package.json";
const MODULES = "node_modules";

const RootManifest = z.object({
  patchedDependencies: z.record(z.string(), z.string()).default({}),
});
const PackageManifest = z.object({ version: z.string() });

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

// Splits at the last "@", since a scoped name starts with one.
const parsePatchKey = (key: string) => {
  const at = key.lastIndexOf("@");
  if (at <= 0 || at === key.length - 1) {
    throw new Error(`patchedDependencies key "${key}" names no version`);
  }
  return { name: key.slice(0, at), version: key.slice(at + 1) };
};

const patchEntries = (root: string) =>
  Object.entries(RootManifest.parse(readJson(join(root, MANIFEST))).patchedDependencies).map(
    ([key, patch]) => ({ key, patch, ...parsePatchKey(key) })
  );

const installedVersion = (root: string, name: string) =>
  PackageManifest.parse(readJson(join(root, MODULES, name, MANIFEST))).version;

/** Keys whose version is not the one installed, with the version that is. */
const stalePatches = (root: string) =>
  patchEntries(root).flatMap(({ key, name, version }) => {
    const installed = installedVersion(root, name);
    return installed === version ? [] : [{ key, installed }];
  });

const missingPatchFiles = (root: string) =>
  patchEntries(root)
    .map(({ patch }) => patch)
    .filter((patch) => !existsSync(join(root, patch)));

// Scoped, so its key carries two "@".
const FIXTURE_PACKAGE = "@fixture/pkg";
const PINNED = "1.2.3";
const BUMPED = "1.3.0";
const KEY = `${FIXTURE_PACKAGE}@${PINNED}`;
const PATCH = "patches/fixture.patch";
const TEMP_PREFIX = "patch-guard-";

const writeFile = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

describe("patch guard", () => {
  const roots: string[] = [];

  // A repo that patches KEY, with the package installed at `installed`.
  const fixture = (installed: string) => {
    const root = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
    roots.push(root);
    writeFile(join(root, MANIFEST), JSON.stringify({ patchedDependencies: { [KEY]: PATCH } }));
    writeFile(
      join(root, MODULES, FIXTURE_PACKAGE, MANIFEST),
      JSON.stringify({ version: installed })
    );
    writeFile(join(root, PATCH), "");
    return root;
  };

  afterEach(() => {
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

  it("passes a scoped package installed at the keyed version", () => {
    expect(stalePatches(fixture(PINNED))).toEqual([]);
  });

  it("reports a package installed at another version", () => {
    expect(stalePatches(fixture(BUMPED))).toEqual([{ key: KEY, installed: BUMPED }]);
  });

  it("reports a key whose patch file is missing", () => {
    const root = fixture(PINNED);
    rmSync(join(root, PATCH));
    expect(missingPatchFiles(root)).toEqual([PATCH]);
  });

  it("rejects a key with no version", () => {
    expect(() => parsePatchKey(FIXTURE_PACKAGE)).toThrow(FIXTURE_PACKAGE);
  });
});

describe("patchedDependencies", () => {
  it("keys every patch to the installed version of its package", () => {
    expect(stalePatches(REPO_ROOT)).toEqual([]);
  });

  it("finds every patch file", () => {
    expect(missingPatchFiles(REPO_ROOT)).toEqual([]);
  });
});

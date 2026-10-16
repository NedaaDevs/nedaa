import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createAutolinkingOptionsLoader } from "expo-modules-autolinking/build/commands/autolinkingOptions";
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

// A precompiled iOS module links a prebuilt xcframework, which no patch
// reaches. These checks fail while a patched package could link prebuilt.

// The platform the Podfile's autolinking step resolves its options for.
const PODFILE_PLATFORM = "apple";
const AUTOLINKING = "expo-modules-autolinking";
const SPM_CONFIG = "spm.config.json";

const SpmConfig = z.object({
  products: z.array(z.object({ podName: z.string().optional() })).default([]),
});

// Third-party configs ship inside autolinking; Expo packages carry their own.
const spmConfigPath = (root: string, name: string) =>
  [
    join(root, MODULES, AUTOLINKING, "external-configs", "ios", name, SPM_CONFIG),
    join(root, MODULES, name, SPM_CONFIG),
    join(root, MODULES, name, "ios", SPM_CONFIG),
  ].find((path) => existsSync(path));

// Autolinking anchors each pattern and tests it on the npm name and pod names.
const buildsFromSource = (patterns: string[], names: string[]) =>
  patterns.some((pattern) => names.some((name) => new RegExp(`^${pattern}$`).test(name)));

/** Patched packages that a precompiled build could link without their patch. */
const prebuildablePatches = async (root: string) => {
  const { buildFromSource = [] } = await createAutolinkingOptionsLoader({
    projectRoot: root,
  }).getPlatformOptions(PODFILE_PLATFORM);
  return patchEntries(root).flatMap(({ name }) => {
    const config = spmConfigPath(root, name);
    if (!config) return [];
    const pods = SpmConfig.parse(readJson(config)).products.flatMap(({ podName }) =>
      podName ? [podName] : []
    );
    return buildsFromSource(buildFromSource, [name, ...pods]) ? [] : [name];
  });
};

// Scoped, so its key carries two "@".
const FIXTURE_PACKAGE = "@fixture/pkg";
const PINNED = "1.2.3";
const BUMPED = "1.3.0";
const KEY = `${FIXTURE_PACKAGE}@${PINNED}`;
const PATCH = "patches/fixture.patch";
const TEMP_PREFIX = "patch-guard-";

const FIXTURE_POD = "FixturePod";
const FIXTURE_SPM_CONFIG = join(MODULES, FIXTURE_PACKAGE, SPM_CONFIG);

const writeFile = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

describe("patch guard", () => {
  const roots: string[] = [];

  // A repo that patches KEY, with the package installed at `installed`.
  const fixture = (installed: string, buildFromSource?: string[]) => {
    const root = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
    roots.push(root);
    writeFile(
      join(root, MANIFEST),
      JSON.stringify({
        patchedDependencies: { [KEY]: PATCH },
        expo: { autolinking: { ios: { buildFromSource } } },
      })
    );
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

  // A precompile config for the patched package, naming its pod.
  const precompiled = (root: string) => {
    writeFile(
      join(root, FIXTURE_SPM_CONFIG),
      JSON.stringify({ products: [{ podName: FIXTURE_POD }] })
    );
    return root;
  };

  it("passes a patched package with no precompile config", async () => {
    await expect(prebuildablePatches(fixture(PINNED))).resolves.toEqual([]);
  });

  it("reports a precompiled patched package not built from source", async () => {
    await expect(prebuildablePatches(precompiled(fixture(PINNED)))).resolves.toEqual([
      FIXTURE_PACKAGE,
    ]);
  });

  it.each([FIXTURE_PACKAGE, FIXTURE_POD])(
    "passes a precompiled patched package built from source as %s",
    async (pattern) => {
      await expect(prebuildablePatches(precompiled(fixture(PINNED, [pattern])))).resolves.toEqual(
        []
      );
    }
  );
});

describe("patchedDependencies", () => {
  it("keys every patch to the installed version of its package", () => {
    expect(stalePatches(REPO_ROOT)).toEqual([]);
  });

  it("finds every patch file", () => {
    expect(missingPatchFiles(REPO_ROOT)).toEqual([]);
  });

  it("builds every precompiled patched package from source on iOS", async () => {
    await expect(prebuildablePatches(REPO_ROOT)).resolves.toEqual([]);
  });
});

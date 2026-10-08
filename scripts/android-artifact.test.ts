import { $ } from "bun";
import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ANDROID_ARTIFACT,
  androidArtifactFromEntries,
  androidArtifactOf,
} from "./android-artifact.ts";

const APK_ENTRIES = ["AndroidManifest.xml", "classes.dex", "lib/arm64-v8a/libhermes.so"];
const AAB_ENTRIES = [
  "BundleConfig.pb",
  "base/manifest/AndroidManifest.xml",
  "base/dex/classes.dex",
];

// Zips files laid out as `entries` and returns the archive path.
const zipOf = async (entries: string[]): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), "android-artifact-"));
  const tree = path.join(dir, "tree");
  for (const entry of entries) {
    await mkdir(path.dirname(path.join(tree, entry)), { recursive: true });
    await writeFile(path.join(tree, entry), "x");
  }
  const archive = path.join(dir, "out.zip");
  await $`zip -qr ${archive} .`.cwd(tree);
  return archive;
};

describe("androidArtifactFromEntries", () => {
  test("reads a root manifest as an APK", () => {
    expect(androidArtifactFromEntries(APK_ENTRIES)).toBe(ANDROID_ARTIFACT.APK);
  });

  test("reads a base-module manifest as an AAB", () => {
    expect(androidArtifactFromEntries(AAB_ENTRIES)).toBe(ANDROID_ARTIFACT.AAB);
  });

  test("rejects an archive that is neither", () => {
    expect(() => androidArtifactFromEntries(["classes.dex"])).toThrow();
  });
});

describe("androidArtifactOf", () => {
  test("classifies a real APK-shaped zip", async () => {
    expect(await androidArtifactOf(await zipOf(APK_ENTRIES))).toBe(ANDROID_ARTIFACT.APK);
  });

  test("classifies a real AAB-shaped zip", async () => {
    expect(await androidArtifactOf(await zipOf(AAB_ENTRIES))).toBe(ANDROID_ARTIFACT.AAB);
  });
});

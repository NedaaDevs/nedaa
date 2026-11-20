import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "@/test-helpers/routeTree";

// The Kotlin Gradle plugin and the Compose compiler plugin must share one
// version, or Gradle fails at configuration. android.kotlinVersion sets both.

const KOTLIN_PLUGIN = {
  GRADLE: "org.jetbrains.kotlin:kotlin-gradle-plugin",
  COMPOSE: "org.jetbrains.kotlin:compose-compiler-gradle-plugin",
} as const;

// The Groovy variable the root build reads android.kotlinVersion into.
const VERSION_FROM_PROPERTY = "$kotlinVersion";

// The Groovy line that reads android.kotlinVersion into that variable.
const VARIABLE_FROM_PROPERTY =
  /def\s+kotlinVersion\s*=\s*findProperty\(\s*['"]android\.kotlinVersion['"]\s*\)/;

// A plugins-block entry, `id "…"` or `id("…")`, takes only a literal version.
const KOTLIN_PLUGIN_WITH_LITERAL =
  /id\s*\(?\s*['"]org\.jetbrains\.kotlin[^'"]*['"]\s*\)?\s*version\b/;

/** The root build minus its block comments and its comment lines. */
const rootBuild = () =>
  readFileSync(join(REPO_ROOT, "android", "build.gradle"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** The version written after `<coordinate>:` in the root build, if any. */
const classpathVersion = (source: string, coordinate: string) => {
  const at = source.indexOf(`${coordinate}:`);
  if (at < 0) return undefined;
  return source.slice(at + coordinate.length + 1).match(/^[^"')]+/)?.[0];
};

describe("Kotlin plugin versions", () => {
  it("reads the version variable from android.kotlinVersion", () => {
    expect(rootBuild()).toMatch(VARIABLE_FROM_PROPERTY);
  });

  it.each(Object.values(KOTLIN_PLUGIN))("%s takes android.kotlinVersion", (coordinate) => {
    expect(classpathVersion(rootBuild(), coordinate)).toBe(VERSION_FROM_PROPERTY);
  });

  it("types no Kotlin plugin version in a plugins block", () => {
    expect(rootBuild()).not.toMatch(KOTLIN_PLUGIN_WITH_LITERAL);
  });
});

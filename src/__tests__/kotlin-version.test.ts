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

// A plugins-block entry takes only a literal version.
const KOTLIN_PLUGIN_WITH_LITERAL = /id\s+['"]org\.jetbrains\.kotlin[^'"]*['"]\s+version\b/;

const rootBuild = () => readFileSync(join(REPO_ROOT, "android", "build.gradle"), "utf8");

/** The version written after `<coordinate>:` in the root build, if any. */
const classpathVersion = (source: string, coordinate: string) => {
  const at = source.indexOf(`${coordinate}:`);
  if (at < 0) return undefined;
  return source.slice(at + coordinate.length + 1).match(/^[^"')]+/)?.[0];
};

describe("Kotlin plugin versions", () => {
  it.each(Object.values(KOTLIN_PLUGIN))("%s takes android.kotlinVersion", (coordinate) => {
    expect(classpathVersion(rootBuild(), coordinate)).toBe(VERSION_FROM_PROPERTY);
  });

  it("types no Kotlin plugin version in a plugins block", () => {
    expect(rootBuild()).not.toMatch(KOTLIN_PLUGIN_WITH_LITERAL);
  });
});

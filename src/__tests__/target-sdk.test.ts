import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "@/test-helpers/routeTree";

/**
 * Android 17 mutes background media audio for apps targeting 37. AthanService plays the
 * athan as media from a background service, so it must get another audio path first.
 */
const PINNED_TARGET_SDK = 36;

const BUILD_PROPERTIES_PLUGIN = "expo-build-properties";

type PluginEntry = string | [string, { android?: { targetSdkVersion?: number } }];

const appJsonTargetSdk = (): number | undefined => {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, "app.json"), "utf8"));
  const plugins: PluginEntry[] = config.expo.plugins;
  const entry = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === BUILD_PROPERTIES_PLUGIN
  );
  return Array.isArray(entry) ? entry[1].android?.targetSdkVersion : undefined;
};

const gradleTargetSdk = (): number | undefined => {
  const source = readFileSync(join(REPO_ROOT, "android", "gradle.properties"), "utf8");
  const match = source.match(/^android\.targetSdkVersion=(\d+)$/m);
  return match ? Number(match[1]) : undefined;
};

describe("Android targetSdk pin", () => {
  it.each([
    ["app.json", appJsonTargetSdk],
    ["android/gradle.properties", gradleTargetSdk],
  ])("%s pins the target SDK the athan is safe on", (_source, read) => {
    expect(read()).toBe(PINNED_TARGET_SDK);
  });
});

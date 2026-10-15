import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AppLocale } from "@/enums/app";
import { REPO_ROOT } from "@/test-helpers/routeTree";

// iOS shows a prompt from the catalog in the phone's language, else Info.plist.
// Prebuild rewrites Info.plist from app.json, so all sources share one English.
const read = (...path: string[]) => readFileSync(join(REPO_ROOT, ...path), "utf8");

const PLIST = read("ios", "nedaa", "Info.plist");
const PBXPROJ = read("ios", "nedaa.xcodeproj", "project.pbxproj");

type StringUnit = { stringUnit: { state: string; value: string } };
type Catalog = { strings: Record<string, { localizations?: Record<string, StringUnit> }> };
const CATALOG: Catalog = JSON.parse(read("ios", "InfoPlist.xcstrings"));

type PluginEntry = string | [string, Record<string, unknown>];
type ExpoConfig = { ios: { infoPlist: Record<string, unknown> }; plugins: PluginEntry[] };
const EXPO: ExpoConfig = JSON.parse(read("app.json")).expo;

/** Release builds delete this key when its text names the dev launcher. */
const DEV_ONLY_KEY = "NSLocalNetworkUsageDescription";

/** The plugin whose option writes the while-in-use prompt. */
const LOCATION_PLUGIN = "expo-location";

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => XML_ENTITIES[name]);

/** The name of a purpose-string key, as regex source. */
const USAGE_KEY = String.raw`NS\w+UsageDescription`;
const isUsageKey = (key: string) => new RegExp(`^${USAGE_KEY}$`).test(key);

const USAGE_ENTRY = new RegExp(
  String.raw`<key>(${USAGE_KEY})</key>\s*<string>([^<]*)</string>`,
  "g"
);

/** Each `NS…UsageDescription` the committed Info.plist ships, with its text. */
const USAGE: Record<string, string> = Object.fromEntries(
  [...PLIST.matchAll(USAGE_ENTRY)].map(([, key, text]) => [key, unescapeXml(text)])
);
// Every prompt a Release build ships, shown or not. Release strips the
// dev launcher's.
const SHIPPED_KEYS = Object.keys(USAGE).filter((key) => key !== DEV_ONLY_KEY);

/** The languages Info.plist declares to iOS. */
const DECLARED = [
  ...(
    PLIST.match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? ""
  ).matchAll(/<string>([^<]+)<\/string>/g),
].map(([, locale]) => locale);

const english = (key: string) => CATALOG.strings[key]?.localizations?.en?.stringUnit.value;

it("declares the app's languages to iOS", () => {
  expect([...DECLARED].sort()).toEqual(Object.values(AppLocale).sort());
});

it.each(SHIPPED_KEYS)("%s has text in every declared language", (key) => {
  const localizations = CATALOG.strings[key]?.localizations ?? {};
  const missing = DECLARED.filter((locale) => !localizations[locale]?.stringUnit.value.trim());
  expect(missing).toEqual([]);
});

it.each(SHIPPED_KEYS)("%s has the same English in the catalog and Info.plist", (key) => {
  expect(english(key)).toBe(USAGE[key]);
});

// A localized prompt is read as written, so a build setting stays unexpanded.
it("names no build setting in a prompt", () => {
  expect(SHIPPED_KEYS.filter((key) => USAGE[key].includes("$("))).toEqual([]);
});

// Prebuild writes these from app.json, so a missing or stale copy there
// undoes Info.plist. The dev client adds the local-network prompt itself.
it("keeps app.json's prompts equal to Info.plist", () => {
  const fromAppJsonKeys = Object.keys(EXPO.ios.infoPlist).filter(isUsageKey);
  expect(fromAppJsonKeys.sort()).toEqual([...SHIPPED_KEYS].sort());
  const fromAppJson = Object.entries(EXPO.ios.infoPlist).filter(([key]) => key in USAGE);
  expect(Object.fromEntries(fromAppJson)).toEqual(
    Object.fromEntries(fromAppJson.map(([key]) => [key, USAGE[key]]))
  );
});

// expo-location's option wins over app.json's infoPlist at prebuild.
it("keeps expo-location's prompt equal to Info.plist", () => {
  const options = EXPO.plugins.find(
    (entry): entry is [string, Record<string, unknown>] =>
      Array.isArray(entry) && entry[0] === LOCATION_PLUGIN
  )?.[1];
  expect(options?.locationWhenInUsePermission).toBe(USAGE.NSLocationWhenInUseUsageDescription);
});

// The Release strip matches the English text; a translation would survive it.
it("keeps the dev-only prompt English and out of the catalog", () => {
  const marker = PBXPROJ.match(
    new RegExp(String.raw`Print :${DEV_ONLY_KEY}[\s\S]*?grep -q \\"([^\\]+)\\"`)
  )?.[1];
  expect(marker).toBeTruthy();
  expect(USAGE[DEV_ONLY_KEY]).toContain(marker);
  expect(CATALOG.strings[DEV_ONLY_KEY]).toBeUndefined();
});

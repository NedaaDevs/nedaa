import { readFileSync } from "node:fs";
import { join } from "node:path";

import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";

const RES = join(__dirname, "..", "..", "modules", "expo-alarm", "android", "src", "main", "res");

type Bundle = Record<string, unknown>;

/** Each Android resource folder, the RN bundle it must say the same as, and its locale. */
export const OVERLAY_BUNDLES: readonly (readonly [string, Bundle, string])[] = [
  ["values", en, "en"],
  ["values-ar", ar, "ar"],
];

const XML_COMMENT = /<!--[\s\S]*?-->/g;
const STRING_ROW = /<string name="([^"]+)">([^<]*)<\/string>/g;
const PLURALS_ROW = /<plurals name="([^"]+)">([\s\S]*?)<\/plurals>/g;
const PLURAL_ITEM = /<item quantity="([^"]+)">([^<]*)<\/item>/g;
const ARGUMENT = /%(\d+)\$[sd]/g;
const PLURAL_COUNT = /%d/g;

// Android drops a value's enclosing quotes, which keep its edge spaces.
const unquote = (value: string): string =>
  value.length > 1 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

const unescapeXml = (value: string): string =>
  unquote(value)
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Comments dropped, so a commented-out row is not read as a live one.
const stringsXml = (folder: string): string =>
  readFileSync(join(RES, folder, "strings.xml"), "utf8").replace(XML_COMMENT, "");

/** A folder's `<string>` rows by name. */
export const androidStrings = (folder: string): Map<string, string> =>
  new Map(
    [...stringsXml(folder).matchAll(STRING_ROW)].map(([, name, value]) => [
      name,
      unescapeXml(value),
    ])
  );

/** A folder's `<plurals>` rows by name, each as quantity to text. */
export const androidPlurals = (folder: string): Map<string, Map<string, string>> =>
  new Map(
    [...stringsXml(folder).matchAll(PLURALS_ROW)].map(([, name, items]) => [
      name,
      new Map(
        [...items.matchAll(PLURAL_ITEM)].map(([, quantity, value]) => [
          quantity,
          unescapeXml(value),
        ])
      ),
    ])
  );

const isBundle = (node: unknown): node is Bundle => typeof node === "object" && node !== null;

/** A bundle's text for a key: a flat key first, else the nested path. */
export const localeValue = (bundle: Bundle, key: string): unknown =>
  key in bundle
    ? bundle[key]
    : key
        .split(".")
        .reduce<unknown>((node, part) => (isBundle(node) ? node[part] : undefined), bundle);

/** An Android string in i18next's form: `%N$d` becomes the N-th name. */
export const asI18next = (value: string, names: readonly string[]): string =>
  value.replace(ARGUMENT, (_, index: string) => `{{${names[Number(index) - 1]}}}`);

/** An Android plural item in i18next's form: `%d` is the count. */
export const pluralAsI18next = (value: string): string => value.replace(PLURAL_COUNT, "{{count}}");

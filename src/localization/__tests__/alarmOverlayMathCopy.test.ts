import { readFileSync } from "node:fs";
import { join } from "node:path";

import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import { ANSWER_CARD_PLACE_KEY, MATH_LINE, MATH_LINE_KEY } from "@/constants/WakeTaskBoards";

const RES = join(
  __dirname,
  "..",
  "..",
  "..",
  "modules",
  "expo-alarm",
  "android",
  "src",
  "main",
  "res"
);

type Bundle = Record<string, unknown>;

const BUNDLES: readonly (readonly [string, Bundle])[] = [
  ["values", en],
  ["values-ar", ar],
];

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_math_new: { key: MATH_LINE_KEY[MATH_LINE.NEW], names: [] },
  overlay_task_math_wrong: { key: MATH_LINE_KEY[MATH_LINE.WRONG], names: [] },
  overlay_task_math_add: { key: "a11y.alarm.task.math.add", names: ["left", "right"] },
  overlay_task_math_multiply: { key: "a11y.alarm.task.math.multiply", names: ["left", "right"] },
  overlay_task_math_after_miss: { key: "a11y.alarm.task.math.afterMiss", names: ["sum"] },
  overlay_task_card: { key: "a11y.alarm.task.card", names: ["label", "place"] },
  overlay_task_card_wrong: { key: "a11y.alarm.task.cardWrong", names: ["card"] },
  overlay_task_card_place_first: { key: ANSWER_CARD_PLACE_KEY[0], names: [] },
  overlay_task_card_place_second: { key: ANSWER_CARD_PLACE_KEY[1], names: [] },
  overlay_task_card_place_third: { key: ANSWER_CARD_PLACE_KEY[2], names: [] },
  overlay_task_card_place_fourth: { key: ANSWER_CARD_PLACE_KEY[3], names: [] },
};

const STRING_ROW = /<string name="([^"]+)">([^<]*)<\/string>/g;
const ARGUMENT = /%(\d+)\$[sd]/g;

const unescapeXml = (value: string): string =>
  value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const androidStrings = (folder: string): Map<string, string> => {
  const xml = readFileSync(join(RES, folder, "strings.xml"), "utf8");
  return new Map(
    [...xml.matchAll(STRING_ROW)].map(([, name, value]) => [name, unescapeXml(value)])
  );
};

const asI18next = (value: string, names: readonly string[]): string =>
  value.replace(ARGUMENT, (_, index: string) => `{{${names[Number(index) - 1]}}}`);

describe.each(BUNDLES)("Math cards overlay copy in %s", (folder, bundle) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(bundle[key]);
  });
});

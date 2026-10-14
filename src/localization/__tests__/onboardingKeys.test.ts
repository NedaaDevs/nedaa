import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import {
  ASR_OPTIONS,
  MIDNIGHT_OPTIONS,
  methodNameKey,
} from "@/components/calculation/calculationOptions";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import { CALCULATION_PICKER, CALCULATION_TITLE_KEY } from "@/constants/Calculation";
import { PRAYER_ID, PRAYER_IDS } from "@/constants/Prayer";
import { CLOCK_FORMAT, NUMERAL_STYLE } from "@/constants/Preferences";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale, TextSize } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import {
  CROWDIN_LOCALES,
  HAND_WRITTEN_LOCALES,
  LOCALE_BUNDLES,
  type HandWrittenLocale,
} from "@/test-helpers/locales";
import { prayerNameKey } from "@/utils/prayerName";

const FLOW_DIR = join(__dirname, "..", "..", "components", "onboarding", "flow");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A flat key, else its path through nested objects, as i18next reads it. */
const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
  key in bundle
    ? bundle[key]
    : key
        .split(".")
        .reduce<unknown>((node, part) => (isRecord(node) ? node[part] : undefined), bundle);

/** Every source file of the flow, tests excluded. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const SOURCE_TEXT = sources(FLOW_DIR).map((path) => readFileSync(path, "utf8"));

// A key starts with a namespace the bundle has; this keeps import paths out.
const NAMESPACES = new Set(Object.keys(en).map((key) => key.split(".")[0]));
const inNamespace = (text: string) => NAMESPACES.has(text.split(".")[0]);

// Keys the flow writes out in full, whatever their namespace.
const LITERAL_KEYS = [
  ...new Set(
    SOURCE_TEXT.flatMap((text) =>
      [...text.matchAll(/(["'`])([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)\1/g)].map(
        ([, , key]) => key
      )
    ).filter(inNamespace)
  ),
];

// Keys the flow builds from a template literal, by shape: `a.${id}` is `a.*`.
const TEMPLATE_SHAPES = [
  ...new Set(
    SOURCE_TEXT.flatMap((text) =>
      [...text.matchAll(/`([^`$]*\$\{[^`]*)`/g)].map(([, shape]) =>
        shape.replace(/\$\{[^}]*\}/g, "*")
      )
    ).filter(inNamespace)
  ),
];

/** `pattern`'s `*` filled with each value. */
const fill = (pattern: string, values: readonly string[]) =>
  values.map((value) => pattern.replace("*", value));

const ALL_LOCALES = Object.values(AppLocale);

// Each template shape the flow uses, with the keys the constants fill into it.
const TEMPLATED: Record<string, readonly string[]> = {
  "settings.languages.*.title": fill("settings.languages.*.title", ALL_LOCALES),
  "settings.languages.*.nativeTitle": fill("settings.languages.*.nativeTitle", ALL_LOCALES),
  "settings.themes.*.title": fill("settings.themes.*.title", APPEARANCE_ORDER),
  "settings.themes.*.description": fill("settings.themes.*.description", APPEARANCE_ORDER),
  "settings.preferences.numerals.options.*": fill(
    "settings.preferences.numerals.options.*",
    Object.values(NUMERAL_STYLE)
  ),
  "settings.preferences.numerals.spoken.*": fill(
    "settings.preferences.numerals.spoken.*",
    Object.values(NUMERAL_STYLE)
  ),
  "settings.preferences.clock.options.*": fill(
    "settings.preferences.clock.options.*",
    Object.values(CLOCK_FORMAT)
  ),
  "settings.preferences.clock.spoken.*": fill(
    "settings.preferences.clock.spoken.*",
    Object.values(CLOCK_FORMAT)
  ),
  "settings.textSize.options.*": fill("settings.textSize.options.*", Object.values(TextSize)),
};

// Names the flow reads through helpers that live outside its folder.
const HELPER_KEYS = [
  // OnboardingPreview: each prayer's name, Dhuhr as Jumuah on a Friday.
  ...PRAYER_IDS.map((id) => prayerNameKey(id, false)),
  prayerNameKey(PRAYER_ID.DHUHR, true),
  // CalculationStep: the three pickers it offers and the choice on each row.
  CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD],
  CALCULATION_TITLE_KEY[CALCULATION_PICKER.ASR],
  CALCULATION_TITLE_KEY[CALCULATION_PICKER.MIDNIGHT],
  ...[...ASR_OPTIONS, ...MIDNIGHT_OPTIONS].map(({ nameKey }) => nameKey),
  ...PRAYER_TIME_PROVIDERS.ALADHAN.methods.flatMap(({ id }) => methodNameKey(id) ?? []),
  "settings.summary.methodAuto",
  // LanguageStep and AppearanceStep: the Settings lists they draw.
  "settings.languages.choose",
  "settings.appearance",
  // spokenDuration: how a countdown is read aloud.
  "a11y.today.durationBoth",
];

// Counted by spokenDuration; the plural forms are keys `<base>_<category>`.
const PLURAL_BASES = ["common.hour", "common.minute"];

const KEYS = [...new Set([...LITERAL_KEYS, ...Object.values(TEMPLATED).flat(), ...HELPER_KEYS])];

const placeholders = (text: string) =>
  [...text.matchAll(/{{(\w+)}}/g)].map(([, name]) => name).sort();

describe("the keys found in the flow", () => {
  it("leave no template shape unexpanded", () => {
    expect(TEMPLATE_SHAPES.filter((shape) => !(shape in TEMPLATED)).sort()).toEqual([]);
  });
});

const hasEnglishPlaceholders = (bundle: Record<string, unknown>, key: string) => {
  const value = lookup(bundle, key);
  expect(typeof value).toBe("string");
  expect(String(value).trim()).not.toBe("");
  expect(placeholders(String(value))).toEqual(placeholders(String(lookup(en, key))));
};

describe.each(HAND_WRITTEN_LOCALES)("%s", (locale) => {
  it.each(KEYS)("has %s, with the English placeholders", (key) => {
    hasEnglishPlaceholders(LOCALE_BUNDLES[locale], key);
  });
});

// Crowdin may not have a new key yet; a key it has keeps the placeholders.
describe.each(CROWDIN_LOCALES)("%s", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];
  const carried = KEYS.filter((key) => lookup(bundle, key) !== undefined);

  it.each(carried)("keeps the English placeholders in %s", (key) => {
    hasEnglishPlaceholders(bundle, key);
  });
});

describe.each(ALL_LOCALES)("the %s plurals", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];
  // i18next picks the form by the locale's own plural rules.
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

  it.each(PLURAL_BASES)("has every plural form of %s", (base) => {
    categories.forEach((category) => {
      const value = lookup(bundle, `${base}_${category}`);
      expect(typeof value).toBe("string");
      expect(String(value).trim()).not.toBe("");
    });
  });
});

// The numerals step's heading, meaning what the Arabic heading means.
const NUMERALS_TITLE: Record<HandWrittenLocale, string> = {
  [AppLocale.EN]: "Choose how numbers and times are shown",
  [AppLocale.AR]: "اختر طريقة عرض الأرقام والوقت",
};

describe.each(HAND_WRITTEN_LOCALES)("the shared copy in %s", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];

  it("heads the numerals step with the Arabic heading's meaning", () => {
    expect(lookup(bundle, "onboarding.numerals.title")).toBe(NUMERALS_TITLE[locale]);
  });

  it("names the app in the calculation intro through the brand key, as Arabic does", () => {
    const brand = "$t(brand.name)";
    expect(String(lookup(bundle, "onboarding.calculation.intro")).includes(brand)).toBe(
      String(lookup(ar, "onboarding.calculation.intro")).includes(brand)
    );
  });
});

// The flow's own copy; keys shared with other screens are judged there.
const OWNED_KEYS = KEYS.filter((key) => /^(a11y\.)?onboarding\./.test(key));

// Isolated runs, placeholders and nested keys are not bare text.
const NOT_BARE = /[\u2066-\u2068][^\u2069]*\u2069|{{\w+}}|\$t\([^)]*\)/g;
const bareLatin = (text: string) => text.replace(NOT_BARE, "").match(/[A-Za-z][\w.-]*/g) ?? [];

describe("the Arabic copy the flow owns", () => {
  it.each(OWNED_KEYS)("wraps each Latin run of %s in an isolate", (key) => {
    expect(bareLatin(String(lookup(ar, key)))).toEqual([]);
  });
});

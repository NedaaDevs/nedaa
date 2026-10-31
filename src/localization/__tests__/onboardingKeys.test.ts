import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import {
  ASR_OPTIONS,
  MIDNIGHT_OPTIONS,
  methodNameKey,
} from "@/components/calculation/calculationOptions";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import {
  ALARM_PERMISSION,
  ALARM_PERMISSION_KIND,
  ALARM_PERMISSION_KINDS,
  ALARM_PERMISSION_TITLE_KEY,
  ALARM_TYPE,
} from "@/constants/Alarm";
import { CALCULATION_PICKER, CALCULATION_TITLE_KEY } from "@/constants/Calculation";
import { PRAYER_ID, PRAYER_IDS } from "@/constants/Prayer";
import { CLOCK_FORMAT, NUMERAL_STYLE } from "@/constants/Preferences";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { TODAY_STYLE } from "@/constants/Today";
import { AppLocale, TextSize } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import {
  CROWDIN_LOCALES,
  HAND_WRITTEN_LOCALES,
  LOCALE_BUNDLES,
  type HandWrittenLocale,
} from "@/test-helpers/locales";
import type { AlarmType } from "@/types/alarm";
import { prayerNameKey } from "@/utils/prayerName";

const FLOW_DIR = join(__dirname, "..", "..", "components", "onboarding", "flow");
// Parts outside the flow that draw its copy, such as the fetch error's offer.
const SHARED_PARTS = [
  join(__dirname, "..", "..", "components", "location", "LocationFailureOffer.tsx"),
  join(__dirname, "..", "..", "components", "today", "UpgradeCard.tsx"),
];

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

const SOURCE_TEXT = [...sources(FLOW_DIR), ...SHARED_PARTS].map((path) =>
  readFileSync(path, "utf8")
);

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

const permissionsOfKind = (kind: string) =>
  Object.values(ALARM_PERMISSION).filter((id) => ALARM_PERMISSION_KINDS[id] === kind);
const ALARM_TYPES = Object.values(ALARM_TYPE);
const ALL_LOCALES = Object.values(AppLocale);

// Each template shape the flow uses, with the keys the constants fill into it.
const TEMPLATED: Record<string, readonly string[]> = {
  "onboarding.alarm.*.title": fill("onboarding.alarm.*.title", ALARM_TYPES),
  "onboarding.alarm.*.body": fill("onboarding.alarm.*.body", ALARM_TYPES),
  "onboarding.alarm.*.question": fill("onboarding.alarm.*.question", ALARM_TYPES),
  "onboarding.alarm.note.*.done": fill(
    "onboarding.alarm.note.*.done",
    Object.values(ALARM_PERMISSION)
  ),
  "onboarding.alarm.note.*.needed": fill(
    "onboarding.alarm.note.*.needed",
    permissionsOfKind(ALARM_PERMISSION_KIND.NEEDED)
  ),
  "onboarding.alarm.note.*.recommended": fill(
    "onboarding.alarm.note.*.recommended",
    permissionsOfKind(ALARM_PERMISSION_KIND.IMPROVES)
  ),
  "settings.languages.*.title": fill("settings.languages.*.title", ALL_LOCALES),
  "settings.languages.*.nativeTitle": fill("settings.languages.*.nativeTitle", ALL_LOCALES),
  "settings.themes.*.title": fill("settings.themes.*.title", APPEARANCE_ORDER),
  "settings.themes.*.description": fill("settings.themes.*.description", APPEARANCE_ORDER),
  "settings.preferences.todayStyle.options.*": fill(
    "settings.preferences.todayStyle.options.*",
    Object.values(TODAY_STYLE)
  ),
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
  // AlarmStep: each permission by the one name Settings › Alarms gives it.
  ...Object.values(ALARM_PERMISSION_TITLE_KEY),
  // spokenDuration: how a countdown is read aloud.
  "a11y.today.durationBoth",
];

// Counted by spokenDuration; the plural forms are keys `<base>_<category>`.
const PLURAL_BASES = ["common.hour", "common.minute"];

// Pages of the Settings alarm gate that an alarm step can lead to.
const SETTINGS_KEYS = [
  "alarm.permission.ios.liveActivities.description",
  "alarm.settings.cityNeeded.title",
  "alarm.settings.cityNeeded.body",
  "alarm.settings.cityNeeded.action",
  "common.notNow",
];

const KEYS = [
  ...new Set([
    ...LITERAL_KEYS,
    ...Object.values(TEMPLATED).flat(),
    ...HELPER_KEYS,
    ...SETTINGS_KEYS,
  ]),
];

const placeholders = (text: string) =>
  [...text.matchAll(/{{(\w+)}}/g)].map(([, name]) => name).sort();

describe("the keys found in the flow", () => {
  it("include keys outside onboarding", () => {
    expect(LITERAL_KEYS).toEqual(
      expect.arrayContaining([
        "common.retry",
        "today.failed.title",
        "location.failure.notFound.title",
        "location.picker.title",
        "location.coordinates.title",
        "a11y.join",
      ])
    );
    expect(LITERAL_KEYS.filter((key) => key.startsWith("onboarding.")).length).toBeGreaterThan(40);
  });

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

// What each locale asks before it turns an alarm on.
const ALARM_QUESTIONS: Record<HandWrittenLocale, Record<AlarmType, string>> = {
  [AppLocale.EN]: {
    [ALARM_TYPE.FAJR]: "Turn on the Fajr alarm now?",
    [ALARM_TYPE.FRIDAY]: "Turn on the Jummah alarm now?",
  },
  [AppLocale.AR]: {
    [ALARM_TYPE.FAJR]: "هل تريد تشغيل منبّه الفجر الآن؟",
    [ALARM_TYPE.FRIDAY]: "هل تريد تشغيل منبّه الجمعة الآن؟",
  },
};

// Wording that calls the alarm reliable; the body may, the question only asks.
const RELIABLE_WORDING: Record<HandWrittenLocale, RegExp> = {
  [AppLocale.EN]: /reliab/i,
  [AppLocale.AR]: /موثوق/,
};

// The city button's spoken name; it opens with the visible words.
const CHOOSE_CITY_LABEL: Record<HandWrittenLocale, string> = {
  [AppLocale.EN]: "Choose my city instead of sharing location",
  [AppLocale.AR]: "اختيار المدينة يدويًا بدلًا من مشاركة الموقع",
};

describe.each(HAND_WRITTEN_LOCALES)("the alarm copy in %s", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];

  it.each(ALARM_TYPES)("asks for the %s alarm without calling it reliable", (type) => {
    const question = String(lookup(bundle, `onboarding.alarm.${type}.question`));
    expect(question).toBe(ALARM_QUESTIONS[locale][type]);
    expect(question).not.toMatch(RELIABLE_WORDING[locale]);
  });

  it("opens the choose-city label with the words on the button", () => {
    const label = String(lookup(bundle, "a11y.onboarding.chooseCityManually"));
    const visible = String(lookup(bundle, "onboarding.location.chooseCity"));
    expect(label).toBe(CHOOSE_CITY_LABEL[locale]);
    expect(label.startsWith(visible)).toBe(true);
  });
});

describe.each(HAND_WRITTEN_LOCALES)("the shared copy in %s", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];

  it("names the app in the calculation intro through the brand key", () => {
    expect(String(lookup(bundle, "onboarding.calculation.intro"))).toContain("$t(brand.name)");
  });

  it("counts the steps in the locale's own «N of M» form", () => {
    const alarmCount = String(lookup(bundle, "onboarding.alarm.count"));
    expect(lookup(bundle, "onboarding.progress")).toBe(
      alarmCount.replace("{{granted}}", "{{current}}")
    );
  });
});

describe("the Arabic alarm copy", () => {
  it.each(ALARM_TYPES)("asks for the %s alarm with «هل تريد»", (type) => {
    expect(String(lookup(ar, `onboarding.alarm.${type}.question`))).toMatch(/^هل تريد /);
  });

  it("calls the prayer alert «تنبيه», keeping «الإشعارات» for the system permission", () => {
    const body = String(lookup(ar, "onboarding.alarm.fajr.body"));
    expect(body).toContain("منفصل عن تنبيه الصلاة العادي");
    expect(body).not.toContain("إشعار");
    const notifications = ALARM_PERMISSION_TITLE_KEY[ALARM_PERMISSION.NOTIFICATIONS];
    expect(lookup(ar, notifications)).toBe("الإشعارات");
  });

  it("tells the reader what stays to do in the way a person says it", () => {
    expect(lookup(ar, "onboarding.alarm.resultBody")).toBe(
      "أنجزنا ما أمكن الآن، ويمكنك إكمال الباقي من الإعدادات متى شئت."
    );
  });
});

// The flow's own copy; keys shared with other screens are judged there.
const OWNED_KEYS = KEYS.filter(
  (key) => /^(a11y\.)?onboarding\./.test(key) || SETTINGS_KEYS.includes(key)
);

// Isolated runs, placeholders and nested keys are not bare text.
const NOT_BARE = /[\u2066-\u2068][^\u2069]*\u2069|{{\w+}}|\$t\([^)]*\)/g;
const bareLatin = (text: string) => text.replace(NOT_BARE, "").match(/[A-Za-z][\w.-]*/g) ?? [];

describe("the Arabic copy the flow owns", () => {
  it.each(OWNED_KEYS)("wraps each Latin run of %s in an isolate", (key) => {
    expect(bareLatin(String(lookup(ar, key)))).toEqual([]);
  });
});

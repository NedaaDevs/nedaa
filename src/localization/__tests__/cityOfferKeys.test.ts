import type { ParseKeys } from "i18next";

import { ZONE_COPY_KEY, ZONE_NOTE_KEY } from "@/constants/CityOffer";
import { AppLocale } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import { HAND_WRITTEN_LOCALES, LOCALE_BUNDLES } from "@/test-helpers/locales";

/** Plain keys with the placeholders every locale's text carries. */
const PARAMS: readonly (readonly [ParseKeys, readonly string[]])[] = [
  ["location.cityOffer.title", ["city"]],
  ["location.cityOffer.body", ["saved"]],
  ["location.cityOffer.bodyNoSavedName", []],
  ["location.cityOffer.use", ["city"]],
  ["location.cityOffer.keep", ["saved"]],
  ["location.cityOffer.useHere", []],
  ["location.cityOffer.keepSaved", []],
  ["location.cityOffer.sameName.title", []],
  ["location.cityOffer.sameName.body", ["distance", "saved"]],
  ["location.cityOffer.unnamed.title", ["distance", "saved"]],
  ["location.cityOffer.unnamed.titleNoSavedName", ["distance"]],
  ["location.cityOffer.offline", ["city"]],
  ["location.cityOffer.offlineHere", []],
  ["location.cityOffer.busy", []],
  ["location.cityOffer.updated.title", ["city"]],
  ["location.cityOffer.updated.titleHere", ["saved"]],
  ["location.cityOffer.updated.titleUnnamed", []],
  ["location.cityOffer.updated.body", ["city"]],
  ["location.cityOffer.updated.bodyHere", []],
  ["location.cityOffer.kept.title", ["saved"]],
  ["location.cityOffer.kept.titleHere", []],
  ["location.cityOffer.kept.body", ["city", "saved"]],
  ["location.cityOffer.kept.bodyHere", ["saved"]],
  ["location.cityOffer.kept.bodyUnnamed", ["saved"]],
  ["location.cityOffer.kept.bodyNoSavedName", ["city"]],
  ["location.cityOffer.dontAsk", ["city"]],
  ["location.cityOffer.dontAskHere", []],
  ["location.cityOffer.muted.title", ["city"]],
  ["location.cityOffer.muted.titleHere", []],
  ["location.cityOffer.muted.body", []],
  ["location.cityOffer.notApplied.title", []],
  ["location.cityOffer.notApplied.body", []],
  ["a11y.location.cityOffer.useHint", ["city"]],
  ["a11y.location.cityOffer.useHereHint", []],
  ["a11y.location.cityOffer.keepHint", ["saved"]],
  ["a11y.location.cityOffer.keepSavedHint", []],
  ["a11y.location.cityOffer.dontAskHint", []],
  ["location.failure.times.title", ["city"]],
  ["location.update.step.findingPlace", []],
  ["location.update.steps.placeRow", []],
  ["location.hero.timesForCity", ["city"]],
  ["location.hero.timesForSavedPlace", []],
  ["location.travel.ask.title", []],
  ["location.travel.ask.note", []],
  ["location.travel.auto.title", []],
  ["location.travel.comingLater", []],
  ["location.travel.off.title", []],
  ["location.travel.off.note", ["city"]],
  ["location.travel.off.noteNoSavedName", []],
  ["location.travel.notAsked.title", []],
  ["location.travel.notAsked.askAgain", []],
  ["location.travel.notAsked.near", ["distance", "saved"]],
  ["location.travel.notAsked.nearNoSavedName", ["distance"]],
  ["a11y.location.travel.askAgainHint", ["place"]],
  ["a11y.location.travel.askAgainNearHint", ["distance", "saved"]],
  ["a11y.location.travel.askAgainNearNoSavedNameHint", ["distance"]],
];

const KEYS = PARAMS.map(([key]) => key);

/** Keys read with `count`; each locale carries its own plural forms. */
const COUNT_KEYS: readonly ParseKeys[] = [ZONE_COPY_KEY, ZONE_NOTE_KEY].flatMap((keys) =>
  Object.values(keys).flatMap(Object.values)
);

/** The app's name is spelled only through brand.name. */
const HAND_WRITTEN_NAME = /nedaa|ن[ِ]?داء/i;
const YOUR_LOCATION = /your location|موقعك/i;

describe.each(HAND_WRITTEN_LOCALES)("city offer copy in %s", (locale) => {
  const bundle = LOCALE_BUNDLES[locale];
  const forms = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  const countKeys = COUNT_KEYS.flatMap((key) => forms.map((form) => `${key}_${form}`));
  const copy = [...KEYS, ...countKeys].map((key) => String(bundle[key]));

  it.each(KEYS)("defines %s with its placeholders", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
    (PARAMS.find(([k]) => k === key)?.[1] ?? []).forEach((param) =>
      expect(String(bundle[key])).toContain(`{{${param}}}`)
    );
  });

  it.each(COUNT_KEYS)("says %s in every plural form of the locale", (key) => {
    forms.forEach((form) => expect(bundle[`${key}_${form}`]).toEqual(expect.stringMatching(/\S/)));
  });

  it('names the city, never "your location"', () => {
    expect(copy.filter((text) => YOUR_LOCATION.test(text))).toEqual([]);
  });

  it("spells the app's name only through brand.name", () => {
    expect(copy.filter((text) => HAND_WRITTEN_NAME.test(text))).toEqual([]);
  });
});

// A shipped key never takes a new value.
describe("shipped location copy", () => {
  it.each([
    [AppLocale.EN, en, "today.failed.title", "Couldn't load the times"],
    [AppLocale.AR, ar, "today.failed.title", "تعذّر تحميل المواقيت"],
  ] as const)("keeps the %s value of %s", (_locale, bundle, key, value) => {
    expect(bundle[key]).toBe(value);
  });
});

import {
  OVERLAY_BUNDLES,
  androidPlurals,
  androidStrings,
  asI18next,
} from "@/test-helpers/overlayStrings";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_start: { key: "alarm.task.start", names: [] },
  overlay_task_pair: { key: "alarm.task.pair", names: ["first", "second"] },
};

const STEPS_PLURAL = "overlay_task_with_steps";
const STEPS_KEY = "alarm.task.withSteps";
const STEPS_NAMES = ["name", "count"] as const;

describe.each(OVERLAY_BUNDLES)("Start overlay copy in %s", (folder, bundle, locale) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(bundle[key]);
  });

  it("names one task's steps in every plural form the locale has, with RN's words", () => {
    const items = androidPlurals(folder).get(STEPS_PLURAL);
    const rnForms = Object.entries(bundle)
      .filter(([key]) => key.startsWith(`${STEPS_KEY}_`))
      .map(([key, value]) => [key.slice(STEPS_KEY.length + 1), value]);

    expect([...(items?.keys() ?? [])].sort()).toEqual(
      [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort()
    );
    expect(
      Object.fromEntries(
        [...(items ?? new Map<string, string>())].map(([q, v]) => [q, asI18next(v, STEPS_NAMES)])
      )
    ).toEqual(Object.fromEntries(rnForms));
  });
});

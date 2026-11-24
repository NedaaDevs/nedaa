import {
  OVERLAY_BUNDLES,
  androidPlurals,
  androidStrings,
  asI18next,
  pluralAsI18next,
} from "@/test-helpers/overlayStrings";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_start: { key: "alarm.task.start", names: [] },
  overlay_task_pair: { key: "alarm.task.pair", names: ["first", "second"] },
};

// Each overlay plural's RN key and its %N$ argument names; a bare %d is the count.
const OVERLAY_PLURAL_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_start_count: { key: "alarm.task.startCount", names: [] },
  overlay_task_with_steps: { key: "alarm.task.withSteps", names: ["name", "count"] },
};

describe.each(OVERLAY_BUNDLES)("Start overlay copy in %s", (folder, bundle, locale) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(bundle[key]);
  });

  it.each(Object.entries(OVERLAY_PLURAL_TO_LOCALE))(
    "%s has every plural form the locale has, with RN's words",
    (name, { key, names }) => {
      const items = androidPlurals(folder).get(name);
      const rnForms = Object.entries(bundle)
        .filter(([rnKey]) => rnKey.startsWith(`${key}_`))
        .map(([rnKey, value]) => [rnKey.slice(key.length + 1), value]);

      expect([...(items?.keys() ?? [])].sort()).toEqual(
        [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort()
      );
      expect(
        Object.fromEntries(
          [...(items ?? new Map<string, string>())].map(([q, v]) => [
            q,
            pluralAsI18next(asI18next(v, names)),
          ])
        )
      ).toEqual(Object.fromEntries(rnForms));
    }
  );
});

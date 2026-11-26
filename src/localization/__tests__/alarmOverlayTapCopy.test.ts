import {
  OVERLAY_BUNDLES,
  androidPlurals,
  androidStrings,
  asI18next,
  pluralAsI18next,
} from "@/test-helpers/overlayStrings";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_tap_count: { key: "alarm.task.tapCount", names: ["done", "total"] },
  overlay_task_tap_here: { key: "alarm.task.tapHere", names: [] },
};

const ASK_PLURAL = "overlay_task_tap_ask";
const ASK_KEY = "alarm.task.tapAsk";

describe.each(OVERLAY_BUNDLES)("Tap overlay copy in %s", (folder, bundle, locale) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(bundle[key]);
  });

  it("asks in every plural form the locale has, with RN's words", () => {
    const items = androidPlurals(folder).get(ASK_PLURAL);
    const rnForms = Object.entries(bundle)
      .filter(([key]) => key.startsWith(`${ASK_KEY}_`))
      .map(([key, value]) => [key.slice(ASK_KEY.length + 1), value]);

    expect([...(items?.keys() ?? [])].sort()).toEqual(
      [...new Intl.PluralRules(locale).resolvedOptions().pluralCategories].sort()
    );
    expect(
      Object.fromEntries(
        [...(items ?? new Map<string, string>())].map(([q, v]) => [q, pluralAsI18next(v)])
      )
    ).toEqual(Object.fromEntries(rnForms));
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  OVERLAY_BUNDLES,
  androidPlurals,
  androidStrings,
  asI18next,
  localeValue,
  pluralAsI18next,
} from "@/test-helpers/overlayStrings";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_start: { key: "alarm.task.start", names: [] },
  overlay_task_pair: { key: "alarm.task.pair", names: ["first", "second"] },
  overlay_task_back: { key: "alarm.task.back", names: [] },
  overlay_back_to: { key: "a11y.backTo", names: ["screen"] },
  overlay_ringing_prayer_alarm: { key: "alarm.ringing.prayerAlarm", names: [] },
  overlay_prayer_fajr: { key: "prayerTimes.fajr", names: [] },
  overlay_ringing_jumuah: { key: "prayerTimes.jumuah", names: [] },
  overlay_ringing_fajr_alarm: { key: "alarm.types.fajr", names: [] },
  overlay_ringing_friday_alarm: { key: "alarm.types.friday", names: [] },
  overlay_ringing_alarm: { key: "alarm.types.custom", names: [] },
  overlay_ringing_current_time: { key: "a11y.alarm.currentTime", names: ["time"] },
  overlay_ringing_at: { key: "a11y.alarm.ringingAt", names: ["alarm", "time"] },
  overlay_ringing_announcement: { key: "a11y.alarm.ringingAnnouncement", names: ["prayer"] },
  overlay_ringing_custom: { key: "a11y.alarm.ringingCustom", names: [] },
  overlay_ringing_snooze_off: { key: "alarm.ringing.snoozeOff", names: [] },
  overlay_ringing_snooze_used_up: { key: "alarm.ringing.snoozeUsedUp", names: [] },
  overlay_join: { key: "a11y.join", names: ["first", "second"] },
  overlay_solved_title: { key: "alarm.solved.title", names: [] },
  overlay_close: { key: "common.close", names: [] },
};

// Each overlay plural's RN key and its %N$ argument names; a bare %d is the count.
const OVERLAY_PLURAL_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_start_count: { key: "alarm.task.startCount", names: [] },
  overlay_task_with_steps: { key: "alarm.task.withSteps", names: ["name", "count"] },
  overlay_ringing_snooze: { key: "alarm.ringing.snooze", names: [] },
  overlay_ringing_snoozes_left: { key: "alarm.ringing.snoozesLeft", names: [] },
};

describe.each(OVERLAY_BUNDLES)("Start overlay copy in %s", (folder, bundle, locale) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(localeValue(bundle, key));
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

// RingingStringsTest reads the same table: a ringing rule's key to its resource.
const RINGING_STRINGS = join(
  __dirname,
  "..",
  "..",
  "..",
  "modules",
  "expo-alarm",
  "fixtures",
  "ringing-strings.tsv"
);

describe("ringing-strings.tsv", () => {
  const rows = readFileSync(RINGING_STRINGS, "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

  it.each(rows)("%s is drawn by %s, which says what RN says", (key, resource) => {
    expect(OVERLAY_TO_LOCALE[resource]?.key).toBe(key);
  });
});

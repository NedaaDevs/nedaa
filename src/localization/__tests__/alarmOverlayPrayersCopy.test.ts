import { PRAYER_IDS } from "@/constants/Prayer";
import { PRAYER_LINE, PRAYER_LINE_KEY, PRAYER_PLACE_KEY } from "@/constants/WakeTaskBoards";
import {
  OVERLAY_BUNDLES,
  androidStrings,
  asI18next,
  localeValue,
} from "@/test-helpers/overlayStrings";
import { prayerNameKey } from "@/utils/prayerName";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_prayers_ask: { key: "alarm.task.prayers.ask", names: ["first", "last"] },
  overlay_task_prayers_wrong: { key: PRAYER_LINE_KEY[PRAYER_LINE.WRONG], names: ["prayer"] },
  overlay_task_prayers_dealt: { key: PRAYER_LINE_KEY[PRAYER_LINE.DEALT], names: [] },
  overlay_task_prayers_dealt_next: {
    key: PRAYER_LINE_KEY[PRAYER_LINE.DEALT_NEXT],
    names: ["prayer"],
  },
  overlay_task_prayers_after_miss: {
    key: "a11y.alarm.task.prayers.afterMiss",
    names: ["prayer"],
  },
  ...Object.fromEntries(
    PRAYER_IDS.flatMap((prayer) => [
      [`overlay_task_prayers_empty_${prayer}`, { key: PRAYER_PLACE_KEY[prayer].empty, names: [] }],
      [
        `overlay_task_prayers_filled_${prayer}`,
        { key: PRAYER_PLACE_KEY[prayer].filled, names: ["prayer"] },
      ],
      [`overlay_prayer_${prayer}`, { key: prayerNameKey(prayer, false), names: [] }],
    ])
  ),
};

describe.each(OVERLAY_BUNDLES)("Prayers overlay copy in %s", (folder, bundle) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(localeValue(bundle, key));
  });
});

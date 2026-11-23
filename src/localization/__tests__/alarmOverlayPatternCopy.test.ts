import {
  PATTERN_PAD,
  PATTERN_PAD_NAME_KEY,
  PATTERN_PAD_PLACE_KEY,
  PATTERN_PADS,
  type PatternPad,
} from "@/constants/WakeTaskBoards";
import {
  OVERLAY_BUNDLES,
  androidStrings,
  asI18next,
  localeValue,
} from "@/test-helpers/overlayStrings";

/** The Android name part for each pad's place. */
const PLACE_NAME = {
  [PATTERN_PAD.CIRCLE]: "top_left",
  [PATTERN_PAD.TRIANGLE]: "top_right",
  [PATTERN_PAD.SQUARE]: "bottom_left",
  [PATTERN_PAD.LINES]: "bottom_right",
} as const satisfies Record<PatternPad, string>;

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_pattern_watch_ask: { key: "alarm.task.pattern.watchAsk", names: [] },
  overlay_task_pattern_turn_ask: { key: "alarm.task.pattern.turnAsk", names: [] },
  overlay_task_pattern_showing: { key: "alarm.task.pattern.showing", names: ["at", "total"] },
  overlay_task_pattern_showing_new: {
    key: "alarm.task.pattern.showingNew",
    names: ["at", "total"],
  },
  overlay_task_pattern_turn: { key: "alarm.task.pattern.turn", names: ["done", "total"] },
  overlay_task_pattern_wrong: { key: "alarm.task.pattern.wrong", names: [] },
  overlay_task_pattern_done: { key: "alarm.task.pattern.done", names: [] },
  overlay_task_pattern_watch: { key: "a11y.alarm.task.pattern.watch", names: ["order"] },
  overlay_task_pattern_after_miss: {
    key: "a11y.alarm.task.pattern.afterMiss",
    names: ["order"],
  },
  overlay_task_pattern_again: { key: "a11y.alarm.task.pattern.again", names: ["order"] },
  overlay_task_pattern_hear_again: { key: "a11y.alarm.task.pattern.hearAgain", names: [] },
  overlay_sentences: { key: "a11y.sentences", names: ["first", "second"] },
  overlay_list_separator: { key: "common.listSeparator", names: [] },
  ...Object.fromEntries(
    PATTERN_PADS.flatMap((pad) => [
      [`overlay_task_pattern_pad_${pad}`, { key: PATTERN_PAD_NAME_KEY[pad], names: [] }],
      [
        `overlay_task_pattern_place_${PLACE_NAME[pad]}`,
        { key: PATTERN_PAD_PLACE_KEY[pad], names: [] },
      ],
    ])
  ),
};

describe.each(OVERLAY_BUNDLES)("Pattern overlay copy in %s", (folder, bundle) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(localeValue(bundle, key));
  });
});

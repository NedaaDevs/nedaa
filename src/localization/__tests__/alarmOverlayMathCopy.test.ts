import { ANSWER_CARD_PLACE_KEY, MATH_LINE, MATH_LINE_KEY } from "@/constants/WakeTaskBoards";
import { OVERLAY_BUNDLES, androidStrings, asI18next } from "@/test-helpers/overlayStrings";

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

describe.each(OVERLAY_BUNDLES)("Math cards overlay copy in %s", (folder, bundle) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(bundle[key]);
  });
});

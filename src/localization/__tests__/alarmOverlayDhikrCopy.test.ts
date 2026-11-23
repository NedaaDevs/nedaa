import { WAKE_TASK_ID } from "@/constants/WakeTask";
import { WAKE_TASK_NAME_KEY } from "@/constants/WakeTaskShell";
import {
  OVERLAY_BUNDLES,
  androidStrings,
  asI18next,
  localeValue,
} from "@/test-helpers/overlayStrings";

// Each overlay string's RN key, and the names its %N$ arguments carry in order.
const OVERLAY_TO_LOCALE: Record<string, { key: string; names: readonly string[] }> = {
  overlay_task_dhikr_ask: { key: "alarm.task.dhikr.ask", names: [] },
  overlay_task_dhikr_completed: { key: "alarm.task.dhikr.completed", names: [] },
  overlay_task_dhikr_another: { key: "alarm.task.dhikr.another", names: [] },
  overlay_task_dhikr_completed_spoken: {
    key: "a11y.alarm.task.dhikr.completed",
    names: ["word", "dhikr"],
  },
  overlay_task_dhikr_gap: { key: "a11y.alarm.task.dhikr.gap", names: [] },
  overlay_task_dhikr_another_spoken: { key: "a11y.alarm.task.dhikr.another", names: ["dhikr"] },
  overlay_task_name_dhikr: { key: WAKE_TASK_NAME_KEY[WAKE_TASK_ID.DHIKR], names: [] },
};

describe.each(OVERLAY_BUNDLES)("Dhikr overlay copy in %s", (folder, bundle) => {
  const strings = androidStrings(folder);

  it.each(Object.entries(OVERLAY_TO_LOCALE))("%s says what RN says", (name, { key, names }) => {
    const value = strings.get(name);
    expect(value).toBeDefined();
    expect(asI18next(value ?? "", names)).toBe(localeValue(bundle, key));
  });
});

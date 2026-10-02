import { useTranslation } from "react-i18next";

import { useCountdownTimer } from "@/hooks/useCountdownTimer";
import type { FocusCount, FocusPrayer } from "@/utils/focusCount";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

export type FocusPrayerView = {
  count: FocusCount;
  /** Whether the named prayer is the next one or the one just come in. */
  label: string;
  /** The prayer Today names: the one just come in, else the next. */
  name: string;
  /** The prayer the figure counts to or from. */
  counted: string;
};

/** Today's focus prayer by name; null with no later prayer stored. */
export const useFocusPrayer = (flipped = false): FocusPrayerView | null => {
  const { t } = useTranslation();
  const count = useCountdownTimer(flipped);
  if (!count) return null;

  // Friday's Dhuhr is Jumuah, by the day in the prayer's own timezone.
  const nameOf = ({ id, time, timezone }: FocusPrayer) =>
    t(prayerNameKey(id, isFridayInTimeZone(time, timezone)));
  return {
    count,
    label: t(count.current ? "today.focus.current" : "today.focus.next"),
    name: nameOf(count.named),
    counted: nameOf(count.counted),
  };
};

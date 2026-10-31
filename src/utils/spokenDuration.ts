import type { TFunction } from "i18next";

import { COUNT_AXIS } from "@/constants/Countdown";
import type { FocusCount } from "@/utils/focusCount";

/** A figure's duration in whole minutes; spoken seconds would never finish. */
export const spokenDuration = ({ axis, seconds }: FocusCount, t: TFunction): string => {
  const minutes = Math.max(
    1,
    axis === COUNT_AXIS.UNTIL ? Math.ceil(seconds / 60) : Math.floor(seconds / 60)
  );
  const [hours, rest] = [Math.floor(minutes / 60), minutes % 60];
  const hourText = t("common.hour", { count: hours });
  const minuteText = t("common.minute", { count: rest });
  if (hours && rest) return t("a11y.today.durationBoth", { hours: hourText, minutes: minuteText });
  return hours ? hourText : minuteText;
};

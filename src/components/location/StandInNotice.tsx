import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

import { Callout } from "@/components/ui/callout";
import type { StateAction } from "@/components/ui/state-panel";
import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import { useTimesPlace } from "@/hooks/useTimesPlace";

/** Why Makkah's times stand in; null while they are not Makkah's. */
const NOTICE: Record<TimesPlace, ParseKeys | null> = {
  [TIMES_PLACE.DEFAULT]: "today.defaultLocation.body",
  [TIMES_PLACE.AWAITING_TIMES]: "today.defaultLocation.awaitingTimes",
  [TIMES_PLACE.VERIFIED]: null,
  [TIMES_PLACE.UNKNOWN]: null,
};

type Props = { action?: StateAction };

/** Says the times are Makkah's: no place is found, or its times are not in. */
export const StandInNotice = ({ action }: Props) => {
  const { t } = useTranslation();
  const notice = NOTICE[useTimesPlace()];
  if (!notice) return null;
  return <Callout body={t(notice)} action={action} />;
};

import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

import { Callout } from "@/components/ui/callout";
import type { StateAction } from "@/components/ui/state-panel";
import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import { useTimesPlace } from "@/hooks/useTimesPlace";

/** Why Makkah's times stand in; null while they are not Makkah's. */
const noticeFor = (place: TimesPlace): ParseKeys | null => {
  switch (place) {
    case TIMES_PLACE.DEFAULT:
      return "today.defaultLocation.body";
    case TIMES_PLACE.AWAITING_TIMES:
      return "today.defaultLocation.awaitingTimes";
    case TIMES_PLACE.VERIFIED:
    case TIMES_PLACE.UNKNOWN:
      return null;
    default: {
      const unhandled: never = place;
      return unhandled;
    }
  }
};

type Props = { action?: StateAction };

/** Says the times are Makkah's: no place is found, or its times are not in. */
export const StandInNotice = ({ action }: Props) => {
  const { t } = useTranslation();
  const notice = noticeFor(useTimesPlace());
  if (!notice) return null;
  return <Callout body={t(notice)} action={action} />;
};

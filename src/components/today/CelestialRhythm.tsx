import { useTranslation } from "react-i18next";

import { PRAYER_ICONS } from "@/components/today/prayerIcons";
import { Box } from "@/components/ui/box";
import { Timeline } from "@/components/ui/timeline";
import { TICK_STATE } from "@/constants/Timeline";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useShownDay } from "@/hooks/useShownDay";
import { prayerNameKey } from "@/utils/prayerName";
import { rhythmLine, type RhythmTimingId } from "@/utils/rhythm";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

export const RHYTHM_PART = { ROOT: "celestial-rhythm" } as const;

type Props = {
  /** The prayer whose card is chosen; its mark lights up. */
  selected?: PrayerId;
  /** Fades the rhythm while a state panel covers the day. */
  dimmed?: boolean;
};

/** The prayer day as a line from Fajr to Isha, each timing where it falls. */
export const CelestialRhythm = ({ selected, dimmed }: Props) => {
  const { t } = useTranslation();
  const { now, day: today, following } = useShownDay();

  if (!today) return null;

  const friday = isFridayInTimeZone(now, today.timezone);
  const nameOf = (id: RhythmTimingId) => {
    if (id === OTHER_TIMING.SUNRISE) return t("otherTimings.sunrise");
    return t(prayerNameKey(id, friday));
  };

  const { marks, progress, focus } = rhythmLine(today, now, following);
  const current = marks.find((mark) => mark.state === TICK_STATE.CURRENT)?.id;

  const summary = (() => {
    if (current === undefined) {
      return t("a11y.rhythm.beforeFajr", { prayer: nameOf(PRAYER_ID.FAJR) });
    }
    if (current === OTHER_TIMING.SUNRISE) {
      return t("a11y.rhythm.afterSunrise", { prayer: nameOf(PRAYER_ID.DHUHR) });
    }
    return t("a11y.rhythm.current", { prayer: nameOf(current) });
  })();

  return (
    <Box
      testID={RHYTHM_PART.ROOT}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summary}
      opacity={dimmed ? 0.35 : 1}>
      <Timeline
        marks={marks.map((mark) => ({
          ...mark,
          icon: PRAYER_ICONS[mark.id],
          label: nameOf(mark.id),
        }))}
        progress={progress}
        accent={focus ?? undefined}
        selected={selected}
      />
    </Box>
  );
};

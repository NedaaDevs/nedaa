import { useTranslation } from "react-i18next";
import {
  MoonStar,
  Sun,
  SunDim,
  SunMedium,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Timeline } from "@/components/ui/timeline";
import { TICK_STATE } from "@/constants/Timeline";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useTodayClock } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { rhythmLine, type RhythmTimingId } from "@/utils/rhythm";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

export const RHYTHM_PART = { ROOT: "celestial-rhythm" } as const;

const ICONS: Record<RhythmTimingId, LucideIcon> = {
  [PRAYER_ID.FAJR]: Sunrise,
  [OTHER_TIMING.SUNRISE]: Sun,
  [PRAYER_ID.DHUHR]: SunMedium,
  [PRAYER_ID.ASR]: SunDim,
  [PRAYER_ID.MAGHRIB]: Sunset,
  [PRAYER_ID.ISHA]: MoonStar,
};

type Props = {
  /** The prayer whose card is chosen; its mark lights up. */
  selected?: PrayerId;
  /** Fades the rhythm while a state panel covers the day. */
  dimmed?: boolean;
};

/** The prayer day as a line from Fajr to Isha, each timing where it falls. */
export const CelestialRhythm = ({ selected, dimmed }: Props) => {
  const { t } = useTranslation();
  const now = useTodayClock();
  const today = usePrayerTimesStore((state) => state.todayTimings);

  if (!today) return null;

  const friday = isFridayInTimeZone(now, today.timezone);
  const nameOf = (id: RhythmTimingId) => {
    if (id === OTHER_TIMING.SUNRISE) return t("otherTimings.sunrise");
    if (id === PRAYER_ID.DHUHR && friday) return t("prayerTimes.jumuah");
    return t(`prayerTimes.${id}`);
  };

  const { marks, progress } = rhythmLine(today, now);
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
        marks={marks.map((mark) => ({ ...mark, icon: ICONS[mark.id], label: nameOf(mark.id) }))}
        progress={progress}
        selected={selected}
      />
    </Box>
  );
};

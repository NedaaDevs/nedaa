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

import { Arc, ArcLabels, type ArcDrawing, type ArcSegment } from "@/components/ui/arc";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { SEGMENT_TONE, TICK_STATE, type TickState } from "@/constants/Arc";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useRTL } from "@/contexts/RTLContext";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { RHYTHM_BOX, rhythmGeometry, type RhythmTimingId } from "@/utils/rhythm";
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

const LABEL_COLOUR = {
  [TICK_STATE.PASSED]: "$muted",
  [TICK_STATE.CURRENT]: "$accent",
  [TICK_STATE.FUTURE]: "$fg",
} as const satisfies Record<TickState, string>;

type Props = {
  /** The prayer whose card is chosen; its stretch and tick light up. */
  selected?: PrayerId;
  /** Fades the rhythm while a state panel covers the day. */
  dimmed?: boolean;
};

/** The prayer day as a line from Fajr to Isha, each timing where it falls. */
export const CelestialRhythm = ({ selected, dimmed }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const now = useMinuteClock();
  const today = usePrayerTimesStore((state) => state.todayTimings);

  if (!today) return null;

  const friday = isFridayInTimeZone(now, today.timezone);
  const nameOf = (id: RhythmTimingId) => {
    if (id === OTHER_TIMING.SUNRISE) return t("otherTimings.sunrise");
    if (id === PRAYER_ID.DHUHR && friday) return t("prayerTimes.jumuah");
    return t(`prayerTimes.${id}`);
  };

  // Labels and states do not depend on the box, so the design box answers them.
  const geometry = rhythmGeometry(today, now);
  const passed = new Set(
    geometry.ticks.filter((tick) => tick.state === TICK_STATE.PASSED).map((tick) => tick.id)
  );
  const current = geometry.ticks.find((tick) => tick.state === TICK_STATE.CURRENT)?.id;

  const summary = (() => {
    if (current === undefined) {
      return t("a11y.rhythm.beforeFajr", { prayer: nameOf(PRAYER_ID.FAJR) });
    }
    if (current === OTHER_TIMING.SUNRISE) {
      return t("a11y.rhythm.afterSunrise", { prayer: nameOf(PRAYER_ID.DHUHR) });
    }
    return t("a11y.rhythm.current", { prayer: nameOf(current) });
  })();

  const draw = (box: { width: number; height: number }): ArcDrawing => {
    const drawn = rhythmGeometry(today, now, { ...box, isRTL });
    const ends = [drawn.ticks[0].x, drawn.ticks[drawn.ticks.length - 1].x];
    return {
      track: drawn.track,
      horizon: {
        y: (RHYTHM_BOX.horizon / RHYTHM_BOX.viewHeight) * box.height,
        from: Math.min(...ends),
        to: Math.max(...ends),
      },
      ticks: drawn.ticks,
      segments: Object.values(PRAYER_ID).flatMap((prayer): ArcSegment[] => {
        const d = drawn.segments[prayer];
        if (prayer === selected) return [{ id: prayer, d, tone: SEGMENT_TONE.SELECTED }];
        return passed.has(prayer) ? [{ id: prayer, d, tone: SEGMENT_TONE.PASSED }] : [];
      }),
      now: drawn.now,
    };
  };

  return (
    <Box
      testID={RHYTHM_PART.ROOT}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summary}
      opacity={dimmed ? 0.35 : 1}>
      <Arc draw={draw} selected={selected} />
      <ArcLabels
        labels={geometry.labels.map(({ id, share, row, state }) => {
          const colour = id === selected ? "$accent" : LABEL_COLOUR[state];
          return {
            id,
            share,
            row,
            children: (
              <>
                <Icon as={ICONS[id]} size="2xs" color={colour} />
                <Text
                  size="sm"
                  typography="helper"
                  fontWeight="600"
                  color={colour}
                  numberOfLines={1}
                  // A long name such as «شروق الشمس» shrinks to fit, never cut off.
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}>
                  {nameOf(id)}
                </Text>
              </>
            ),
          };
        })}
      />
    </Box>
  );
};

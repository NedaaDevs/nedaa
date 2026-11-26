import { CelestialRhythm } from "@/components/today/CelestialRhythm";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { FOCUS_LAYOUT } from "@/constants/Countdown";
import type { PrayerId } from "@/constants/Prayer";
import { TODAY_STYLE, type TodayStyle } from "@/constants/Today";

type Props = {
  /** How Today draws the day: the bowl, or the countdown alone. */
  todayStyle: TodayStyle;
  /** The prayer chosen on Today, ringed on the bowl. */
  selected?: PrayerId;
  /** Holds the countdown's second clock while its screen is out of focus. */
  paused?: boolean;
};

/** Today's head in its style: the countdown in the bowl, or in its row. */
export const TodayHero = ({ todayStyle, selected, paused = false }: Props) =>
  todayStyle === TODAY_STYLE.BOWL ? (
    <CelestialRhythm selected={selected}>
      <FocusCountdown paused={paused} layout={FOCUS_LAYOUT.CENTRED} />
    </CelestialRhythm>
  ) : (
    <FocusCountdown paused={paused} />
  );

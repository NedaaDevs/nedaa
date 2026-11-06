import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react-native";

import { DayRunPlayer } from "@/components/onboarding/flow/DayRunPlayer";
import { DaySimulator } from "@/components/today/DaySimulator";
import {
  ThemeTransitionContext,
  type WithThemeTransition,
} from "@/components/ui/theme-transition/context";
import { DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import { useDayRun } from "@/contexts/DayRunContext";
import { useDrawnMode } from "@/contexts/DrawnModeContext";
import { AppLocale } from "@/enums/app";
import { useShownDay } from "@/hooks/useShownDay";
import { ThemeProvider } from "@/test-helpers/theme";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

/** Draws the player while a run is on, as the onboarding frame does. */
export const Player = () => {
  const run = useDayRun();
  return run && run.status !== DAY_RUN_STATUS.IDLE ? <DayRunPlayer /> : null;
};

/** What the parts inside the run read. */
const useRunView = () => ({ run: useDayRun(), drawn: useDrawnMode(), shown: useShownDay() });

const runAtOnce: WithThemeTransition = async (fn) => {
  await fn();
};

type PlayerOptions = { isRTL?: boolean; transition?: WithThemeTransition };

/** A preview run with the player below it; the result reads the run. */
export const renderPlayer = ({ isRTL = false, transition = runAtOnce }: PlayerOptions = {}) =>
  renderHook(useRunView, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider isRTL={isRTL}>
        <ThemeTransitionContext value={transition}>
          <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
            {children}
            <Player />
          </DaySimulator>
        </ThemeTransitionContext>
      </ThemeProvider>
    ),
  });

export type PlayerView = Awaited<ReturnType<typeof renderPlayer>>["result"];

/** The run's clock as the card shows it, in the English 12-hour layout. */
export const liveTime = (result: PlayerView) => {
  const { now, day } = result.current.shown;
  return localizeDigits(
    formatPrayerTime(now, day?.timezone ?? "", { locale: AppLocale.EN, use24HourTime: false }),
    AppLocale.EN,
    true
  );
};

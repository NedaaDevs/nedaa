import type { ReactNode } from "react";
import { act, renderHook, screen, within } from "@testing-library/react-native";

import { DAY_RUN_PLAYER_PART, DayRunPlayer } from "@/components/onboarding/flow/DayRunPlayer";
import { DaySimulator } from "@/components/today/DaySimulator";
import { TEXT_END_ROOM } from "@/components/ui/text";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import { useDayRun } from "@/contexts/DayRunContext";
import { AppLocale, AppMode } from "@/enums/app";
import { useShownDay } from "@/hooks/useShownDay";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { endRoomOf, hostNodesIn } from "@/test-helpers/text";
import { ThemeProvider } from "@/test-helpers/theme";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

// Text reads the platform once, as it loads; this file runs as Android.
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const { PlatformType } = jest.requireActual("@/enums/app");
  native.Platform.OS = PlatformType.ANDROID;
  return native;
});
jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BlurView: (props: object) => createElement(View, props) };
});
// A Reduce Motion run starts at Fajr, playing, with a time to show.
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const NOON = new Date(2026, 9, 24, 12, 30);
const hidden = { includeHiddenElements: true };
const transition = async (fn: () => void | Promise<void>) => {
  await fn();
};

/** Draws the player while a run is on, as the onboarding frame does. */
const Player = () => {
  const run = useDayRun();
  return run && run.status !== DAY_RUN_STATUS.IDLE ? <DayRunPlayer /> : null;
};

const useRunView = () => ({ run: useDayRun(), shown: useShownDay() });

const renderPlayer = () =>
  renderHook(useRunView, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ThemeTransitionContext value={transition}>
          <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
            {children}
            <Player />
          </DaySimulator>
        </ThemeTransitionContext>
      </ThemeProvider>
    ),
  });

describe("DayRunPlayer on Android", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: NOON });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.SYSTEM });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    // No stored times: the run plays the sample day.
    usePrayerTimesStore.setState({ todayTimings: null, usingDefaultLocation: false });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // Running text gets room at its end. The live time is one Text, so it has the
  // room once; a reserve row is many glyphs and gets the room once, on the row.
  it("reserves each clock with the live time's end room, once per row", async () => {
    const { result } = await renderPlayer();
    await act(() => result.current.run?.start());
    expect(TEXT_END_ROOM).toBeGreaterThan(0);

    const slot = screen.getByTestId(DAY_RUN_PLAYER_PART.TIME_SLOT);
    const { now, day } = result.current.shown;
    const shownTime = localizeDigits(
      formatPrayerTime(now, day?.timezone ?? "", { locale: AppLocale.EN, use24HourTime: false }),
      AppLocale.EN,
      true
    );
    const live = within(slot).getByText(shownTime);
    expect(endRoomOf(live)).toBe(TEXT_END_ROOM);

    const rows = within(slot).getAllByTestId(DAY_RUN_PLAYER_PART.CLOCK_RESERVE, hidden);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const rooms = hostNodesIn(row).map(endRoomOf);
      expect(rooms.reduce((sum, room) => sum + room, 0)).toBe(endRoomOf(live));
      expect(endRoomOf(row)).toBe(TEXT_END_ROOM);
    }
  });
});

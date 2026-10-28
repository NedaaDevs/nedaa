import type { ReactNode } from "react";
import { act, renderHook, screen } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import { DaySimulator, useDayRun } from "@/components/today/DaySimulator";
import { TODAY_STYLE_PREVIEW_PART, TodayStylePreview } from "@/components/today/TodayStylePreview";
import { SkyBackground } from "@/components/ui/sky-background";
import { DAY_RUN, DAY_RUN_KIND } from "@/constants/DayRun";
import { TODAY_STYLE } from "@/constants/Today";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useStoredDays } from "@/hooks/useStoredDays";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme, ThemeProvider } from "@/test-helpers/theme";
import type { StoredDays } from "@/utils/phase";
import { sampleDays } from "@/utils/sampleDays";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
// The days Today's head was last drawn from.
const mockHeroDays: StoredDays[] = [];
jest.mock("@/components/today/TodayHero", () => {
  const { useStoredDays: storedDays } = jest.requireActual("@/hooks/useStoredDays");
  const HeroProbe = () => {
    mockHeroDays.push(storedDays());
    return null;
  };
  return { TodayHero: HeroProbe };
});

const NOON = new Date(2026, 9, 24, 12, 30);

const renderPreview = () =>
  renderWithTheme(
    <SkyBackground>
      <TodayStylePreview />
    </SkyBackground>
  );

describe("TodayStylePreview", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOON });
    jest.mocked(withTiming).mockClear();
    jest.mocked(useReducedMotion).mockReturnValue(false);
    usePreferencesStore.setState({ todayStyle: TODAY_STYLE.BOWL, showSeconds: false });
    usePrayerTimesStore.setState({ ...toStore(sampleDays(NOON)), usingDefaultLocation: false });
  });
  afterEach(() => jest.useRealTimers());

  const toStore = (days: ReturnType<typeof sampleDays>) => ({
    yesterdayTimings: days.yesterday ?? null,
    todayTimings: days.today ?? null,
    tomorrowTimings: days.tomorrow ?? null,
  });
  const fades = () => jest.mocked(withTiming).mock.calls.filter(([value]) => value === 1).length;

  it("fades a newly chosen style in", async () => {
    await renderPreview();
    const before = fades();

    await act(() => usePreferencesStore.setState({ todayStyle: TODAY_STYLE.SIMPLE }));

    expect(fades()).toBe(before + 1);
  });

  it("swaps at once under Reduce Motion", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderPreview();
    const before = fades();

    await act(() => usePreferencesStore.setState({ todayStyle: TODAY_STYLE.SIMPLE }));

    expect(fades()).toBe(before);
    expect(screen.getByTestId(TODAY_STYLE_PREVIEW_PART.ROOT)).toHaveStyle({ opacity: 1 });
  });

  describe("in a day run", () => {
    const PREVIEW = DAY_RUN[DAY_RUN_KIND.PREVIEW];
    const renderInRun = () =>
      renderHook(() => ({ run: useDayRun(), days: useStoredDays() }), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ThemeProvider>
            <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
              {children}
              <TodayStylePreview sampleUnlessOwn />
            </DaySimulator>
          </ThemeProvider>
        ),
      });

    beforeEach(() => {
      usePrayerTimesStore.setState({ todayTimings: null });
      mockHeroDays.length = 0;
    });

    // The sky reads the run's days; the preview must not count its own.
    it("draws the run's days, held from the run's start", async () => {
      const { result } = await renderInRun();
      await act(() => result.current.run?.start());
      for (let tick = 0; tick < 3; tick++) {
        await act(() => jest.advanceTimersByTime(PREVIEW.phaseMs));
      }

      expect(result.current.days.today).toEqual(sampleDays(NOON).today);
      expect(mockHeroDays.at(-1)).toBe(result.current.days);
    });

    it("draws a sample at the clock outside a run", async () => {
      await renderInRun();

      expect(mockHeroDays.at(-1)).toEqual(sampleDays(NOON));
    });
  });

  it("draws the stored times with no sample note by default", async () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderPreview();

    expect(screen.queryByTestId(TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE)).toBeNull();
  });
});

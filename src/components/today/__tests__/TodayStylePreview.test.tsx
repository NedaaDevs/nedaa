import { act, screen } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import { TODAY_STYLE_PREVIEW_PART, TodayStylePreview } from "@/components/today/TodayStylePreview";
import { SkyBackground } from "@/components/ui/sky-background";
import { TODAY_STYLE } from "@/constants/Today";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { sampleDays } from "@/utils/sampleDays";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));

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

  it("draws the stored times with no sample note by default", async () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderPreview();

    expect(screen.queryByTestId(TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE)).toBeNull();
  });
});

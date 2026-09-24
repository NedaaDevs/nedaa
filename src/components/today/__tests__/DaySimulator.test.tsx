import { Text } from "react-native";
import { Theme } from "tamagui";
import { act, screen, userEvent } from "@testing-library/react-native";

import { DAY_SIMULATION, DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import config from "../../../../tamagui.config";
import { useTheme } from "@/components/ui/theme-color";
import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppMode } from "@/enums/app";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useAppStore } from "@/stores/app";
import { ONE_DAY_MS } from "@/utils/phase";
import { useTodayClock } from "@/hooks/useTodayClock";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};
// The real store persists through native kv-store calls jest does not load.
jest.mock("@/stores/debugMode", () => {
  const { create } = jest.requireActual("zustand");
  return { useDebugModeStore: create(() => ({ isEnabled: false, toggle: () => {} })) };
});

const NOW = new Date("2026-09-23T02:00:00.000Z");

/** Shows the clock Today's parts read. */
const Clock = () => <Text testID="clock">{useTodayClock().toISOString()}</Text>;
const clock = () => screen.getByTestId("clock").props.children as string;

const renderSimulator = () =>
  renderWithTheme(
    <DaySimulator>
      <Clock />
      <DaySimulatorButton />
    </DaySimulator>
  );

describe("DaySimulator", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    usePrayerTimesStore.setState({ todayTimings: DAY });
    useDebugModeStore.setState({ isEnabled: true });
  });
  afterEach(() => jest.useRealTimers());

  it("offers no simulation outside debug mode", async () => {
    useDebugModeStore.setState({ isEnabled: false });
    await renderSimulator();

    expect(screen.queryByRole("button", { name: DAY_SIMULATION.label })).toBeNull();
  });

  // The moon's arc runs to the next Fajr; stopping at Isha would cut it short.
  it("runs the clock from before Fajr to the next Fajr, then back to live", async () => {
    await renderSimulator();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: DAY_SIMULATION.label }));
    const start = new Date(clock()).getTime();
    expect(start).toBe(new Date(DAY.timings[PRAYER_ID.FAJR]).getTime() - DAY_SIMULATION.marginMs);

    await act(() => jest.advanceTimersByTime(DAY_SIMULATION.tickMs));
    expect(new Date(clock()).getTime() - start).toBe(DAY_SIMULATION.stepMs);

    const nextFajr = new Date(DAY.timings[PRAYER_ID.FAJR]).getTime() + ONE_DAY_MS;
    const steps = Math.floor((nextFajr - start) / DAY_SIMULATION.stepMs);
    for (let i = 1; i < steps; i++) {
      await act(() => jest.advanceTimersByTime(DAY_SIMULATION.tickMs));
    }
    expect(new Date(clock()).getTime()).toBe(start + steps * DAY_SIMULATION.stepMs);

    await act(() => jest.advanceTimersByTime(DAY_SIMULATION.tickMs));

    expect(new Date(clock()).getMinutes()).toBe(new Date().getMinutes());
    expect(new Date(clock()).getHours()).toBe(new Date().getHours());
  });

  // Adaptive draws by the phase; a run must show noon as day, not the live night.
  it("gives Today the simulated phase's brightness and theme", async () => {
    useAppStore.setState({ mode: AppMode.ADAPTIVE });
    const Brightness = () => (
      <Text testID="brightness">{`${useAppIsDark()} ${useTheme().background.val}`}</Text>
    );
    await renderWithTheme(
      <PhaseContext value={PHASE.NIGHT}>
        <Theme name={AppMode.DARK}>
          <DaySimulator>
            <Brightness />
            <DaySimulatorButton />
          </DaySimulator>
        </Theme>
      </PhaseContext>
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole("button", { name: DAY_SIMULATION.label }));

    const toNoon = (8 * 60 * 60_000) / DAY_SIMULATION.stepMs;
    for (let i = 0; i < toNoon; i++) {
      await act(() => jest.advanceTimersByTime(DAY_SIMULATION.tickMs));
    }

    expect(screen.getByTestId("brightness")).toHaveTextContent(
      `false ${config.themes.light.background.val}`
    );
  });
});

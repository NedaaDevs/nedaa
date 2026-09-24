import { Text } from "react-native";
import { act, screen } from "@testing-library/react-native";

import { SKY_PART, SkyBackground } from "@/components/ui/sky-background";
import { DURATION_MS } from "@/constants/Motion";
import { BRIGHTNESS } from "@/constants/Palette";
import { PHASE, type Phase } from "@/constants/Phase";
import { PhaseContext } from "@/contexts/PhaseContext";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import { AppMode } from "@/enums/app";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import { phaseAt } from "@/utils/phase";
import { skyScene } from "@/utils/sky";

/** Fajr 04:00, sunrise 06:00, Maghrib 18:00, in UTC. */
const TODAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:00:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:00:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:00:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:30:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T06:00:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};
const at = (time: string) => new Date(`2026-09-23T${time}:00.000Z`);

// hijri-native is a native module; each test sets the day it returns.
let mockHijriDay = 3;
jest.mock("@/utils/date", () => ({
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: mockHijriDay }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const Sky = ({ phase }: { phase: Phase | undefined }) => (
  <PhaseContext value={phase}>
    <SkyBackground>
      <Text>Today</Text>
    </SkyBackground>
  </PhaseContext>
);

/** Starts the device clock at `time` on the stored day. */
const clockAt = (time: string) => jest.useFakeTimers({ now: at(time) });

/** One minute on, which re-renders the sky through its minute clock. */
const nextMinute = () => act(() => jest.advanceTimersByTime(60_000));

const part = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });

type PaintStyle = { backgroundColor: string; experimental_backgroundImage: string };

/** Each painted sky, back to front. */
const paints = (): PaintStyle[] =>
  part(SKY_PART.PAINT).map((node) => Object.assign({}, ...[node.props.style].flat(Infinity)));

const underlays = () => paints().map((paint) => paint.backgroundColor);

describe("SkyBackground", () => {
  beforeEach(() => {
    mockReduced = false;
    useAppStore.setState({ mode: AppMode.LIGHT });
  });

  it("draws its children over a sky the screen reader skips", async () => {
    await renderWithTheme(<Sky phase={PHASE.DAY} />);

    expect(screen.getByText("Today")).toBeOnTheScreen();
    expect(screen.queryByTestId(SKY_PART.CANVAS)).toBeNull();
    expect(part(SKY_PART.CANVAS)).toHaveLength(1);
  });

  // Adaptive follows the prayer day, whatever the system scheme says.
  it("paints Maghrib dark under Adaptive on a light system", async () => {
    useAppStore.setState({ mode: AppMode.ADAPTIVE });
    await renderWithTheme(<Sky phase={PHASE.MAGHRIB} />);

    expect(paints()[0].backgroundColor).toBe(skyScene(BRIGHTNESS.DARK, PHASE.MAGHRIB).underlay);
  });

  // A debug run or a screenshot seed moves the sky with Today's other parts.
  it("paints the phase of a simulated clock over the live one", async () => {
    usePrayerTimesStore.setState({ todayTimings: TODAY, yesterdayTimings: null });
    const afternoon = at("16:00");
    await renderWithTheme(
      <SimulatedClockContext value={afternoon}>
        <Sky phase={PHASE.DAY} />
      </SimulatedClockContext>
    );
    const simulated = skyScene(BRIGHTNESS.LIGHT, phaseAt(afternoon, { today: TODAY })!);

    expect(simulated.key).not.toBe(skyScene(BRIGHTNESS.LIGHT, PHASE.DAY).key);
    expect(paints()[0].backgroundColor).toBe(simulated.underlay);
    expect(part(SKY_PART.SUN)).toHaveLength(1);
  });

  it.each([
    [AppMode.LIGHT, PHASE.ASR, BRIGHTNESS.LIGHT],
    [AppMode.DARK, PHASE.MAGHRIB, BRIGHTNESS.DARK],
  ])("in %s at %s paints that scene", async (mode, phase, brightness) => {
    useAppStore.setState({ mode });
    await renderWithTheme(<Sky phase={phase} />);
    const scene = skyScene(brightness, phase);

    expect(paints()[0].backgroundColor).toBe(scene.underlay);
    expect(paints()[0].experimental_backgroundImage).toContain(scene.base.stops[1].color);
  });

  it.each([
    [false, "linear-gradient(90deg"],
    [true, "linear-gradient(270deg"],
  ])("turns the edge wash to the reading start (rtl: %s)", async (isRTL, wash) => {
    await renderWithTheme(<Sky phase={PHASE.DAY} />, { isRTL });

    expect(paints()[0].experimental_backgroundImage.startsWith(wash)).toBe(true);
  });

  it("keeps one sky when a phase change paints the same one", async () => {
    const { rerender } = await renderWithTheme(<Sky phase={PHASE.DAY} />);

    await rerender(<Sky phase={PHASE.NIGHT} />);

    expect(part(SKY_PART.PAINT)).toHaveLength(1);
  });

  it("swaps the sky at once under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Sky phase={PHASE.DAY} />);

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(underlays()).toEqual([skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay]);
  });

  // Sunrise 06:00, Maghrib 18:00; still rays keep six hours of fake time cheap.
  it("moves the sun as the clock moves", async () => {
    mockReduced = true;
    usePrayerTimesStore.setState({
      todayTimings: TODAY,
      yesterdayTimings: null,
      tomorrowTimings: null,
    });
    clockAt("09:00");
    await renderWithTheme(<Sky phase={PHASE.DAY} />);
    const morning = paints()[0].experimental_backgroundImage;

    await act(() => jest.advanceTimersByTime(6 * 60 * 60_000));

    expect(paints()[0].experimental_backgroundImage).not.toBe(morning);
    jest.useRealTimers();
  });

  describe("sun", () => {
    afterEach(() => jest.useRealTimers());
    beforeEach(() => {
      clockAt("10:00");
      usePrayerTimesStore.setState({
        todayTimings: TODAY,
        yesterdayTimings: null,
        tomorrowTimings: null,
      });
    });

    // Reduced motion swaps at once, so no crossfade holds the old sun beneath.
    it("draws the sun on a light sky and not on a dark one", async () => {
      mockReduced = true;
      await renderWithTheme(<Sky phase={PHASE.DAY} />);
      expect(part(SKY_PART.SUN)).toHaveLength(1);

      await act(() => useAppStore.setState({ mode: AppMode.DARK }));

      expect(part(SKY_PART.SUN)).toHaveLength(0);
    });

    const raysTurn = () =>
      [part(SKY_PART.SUN_RAYS)[0].props.style]
        .flat(Infinity)
        .some((style) => style && "transform" in style);

    it("turns its rays", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);

      expect(raysTurn()).toBe(true);
    });

    // RN swaps a physical left in RTL but not SVG x; one space keeps them aligned.
    it("draws its rays and bloom in one left-to-right space in RTL", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />, { isRTL: true });

      expect(part(SKY_PART.SUN)[0]).toHaveStyle({ direction: "ltr" });
    });

    it("holds its rays still under reduced motion", async () => {
      mockReduced = true;
      await renderWithTheme(<Sky phase={PHASE.DAY} />);

      expect(raysTurn()).toBe(false);
    });
  });

  describe("moon", () => {
    type HostNode = { props: { d?: string }; children?: (HostNode | string)[] };

    /** The first path drawn under a node. */
    const pathIn = (node: HostNode): string | undefined =>
      node.props.d ??
      node.children
        ?.map((child) => (typeof child === "string" ? undefined : pathIn(child)))
        .find(Boolean);

    const moonPaths = () => part(SKY_PART.MOON).map((node) => pathIn(node as HostNode));

    afterEach(() => jest.useRealTimers());
    beforeEach(() => {
      clockAt("22:00");
      mockHijriDay = 3;
      useAppStore.setState({ hijriDaysOffset: 0 });
      usePrayerTimesStore.setState({
        todayTimings: TODAY,
        yesterdayTimings: null,
        tomorrowTimings: null,
      });
    });

    it("draws the crescent on a dark sky", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);

      expect(moonPaths()).toHaveLength(1);
      expect(moonPaths()[0]).toMatch(/^M /);
    });

    it("draws no moon on a light sky", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);

      expect(part(SKY_PART.MOON)).toHaveLength(0);
    });

    // Android can draw a shape before a moved clip or gradient it points to.
    it("moves the moon without redrawing its face", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);
      // Moved by a transform: a re-layout would make Android redraw the SVG.
      const place = () => {
        const style = Object.assign({}, ...[part(SKY_PART.MOON)[0].props.style].flat());
        expect(style.left).toBe(0);
        return JSON.stringify(style.transform);
      };
      const [face, before] = [moonPaths()[0], place()];

      await act(() => jest.advanceTimersByTime(60 * 60_000));

      expect(place()).not.toBe(before);
      expect(moonPaths()[0]).toBe(face);
    });

    // Earthshine: the unlit part still reads as the moon's body.
    it("shows the whole disc faintly behind the lit part", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);

      expect(part(SKY_PART.MOON_BODY)).toHaveLength(1);
    });

    it("brightens its halo as more of the moon is lit", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      const haloOpacity = () => Number(part(SKY_PART.MOON_HALO)[0].props.opacity);
      mockHijriDay = 2;
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);
      const crescent = haloOpacity();

      mockHijriDay = 14;
      await nextMinute();

      expect(haloOpacity()).toBeGreaterThan(crescent);
    });

    /** The face group's turn, read from the matrix the host receives. */
    const tilt = () => {
      const [a, b] = part(SKY_PART.MOON_FACE)[0].props.matrix as number[];
      return (Math.atan2(b, a) * 180) / Math.PI;
    };

    it("tilts a young moon toward the sun and holds a full one level", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      mockHijriDay = 3;
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);
      const young = tilt();

      mockHijriDay = 15;
      await nextMinute();

      expect(Math.abs(young)).toBeGreaterThan(20);
      expect(Math.abs(tilt())).toBeLessThan(1);
    });

    // The moon shows the Hijri date the user sees, their correction included.
    it("follows the user's Hijri offset", async () => {
      useAppStore.setState({ mode: AppMode.DARK });
      await renderWithTheme(<Sky phase={PHASE.NIGHT} />);
      const thin = moonPaths()[0];

      await act(() => useAppStore.setState({ hijriDaysOffset: 11 }));
      await nextMinute();

      expect(moonPaths()[0]).not.toBe(thin);
    });
  });

  describe("crossfade", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("holds the old sky under the new one while it fades in", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);

      await act(() => useAppStore.setState({ mode: AppMode.DARK }));

      expect(underlays()).toEqual([
        skyScene(BRIGHTNESS.LIGHT, PHASE.DAY).underlay,
        skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay,
      ]);
    });

    it("drops the old sky once the fade ends", async () => {
      await renderWithTheme(<Sky phase={PHASE.DAY} />);
      await act(() => useAppStore.setState({ mode: AppMode.DARK }));

      await act(() => jest.advanceTimersByTime(DURATION_MS.SKY + 100));

      expect(underlays()).toEqual([skyScene(BRIGHTNESS.DARK, PHASE.DAY).underlay]);
    });
  });
});

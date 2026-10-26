import { Animated } from "react-native";
import { act, screen } from "@testing-library/react-native";

import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SunGlyph } from "@/components/ui/sky-background/SunGlyph";
import { SUN_GLYPH } from "@/constants/Sky";
import { renderWithTheme } from "@/test-helpers/theme";

/** Each stop's alpha, from the native gradient's offset and ARGB pairs. */
const alphasOf = (suffix: string) => {
  const [gradient] = screen.container.queryAll(
    (node) => node.type === "RNSVGRadialGradient" && String(node.props.name).endsWith(suffix)
  );
  const pairs: number[] = gradient.props.gradient;
  return pairs.filter((_, i) => i % 2 === 1).map((argb) => (argb >>> 24) / 255);
};

describe("SunGlyph", () => {
  // The sun sits behind the brand and the date, so its bloom stays partial.
  it("draws the bloom at its set strength behind text", async () => {
    await renderWithTheme(<SunGlyph cx={50} cy={50} width={300} height={200} reduced />);

    const drawn = alphasOf("bloom");
    const stops = SUN_GLYPH.bloomStops.map(([, opacity]) => opacity * SUN_GLYPH.bloomStrength);
    expect(SUN_GLYPH.bloomStrength).toBe(0.62);
    expect(drawn).toHaveLength(stops.length);
    drawn.forEach((alpha, i) => expect(alpha).toBeCloseTo(stops[i], 2));
  });

  it("keeps the core blown out", async () => {
    await renderWithTheme(<SunGlyph cx={50} cy={50} width={300} height={200} reduced />);

    expect(alphasOf("core").slice(0, 2)).toEqual([1, 1]);
  });

  // The bowl draws the same sun small: one renderer, two sizes.
  it("draws its core, bloom and rays at a scale", async () => {
    const scale = 0.4;
    await renderWithTheme(
      <SunGlyph cx={50} cy={50} width={300} height={200} reduced scale={scale} />
    );
    const circles = screen.container.queryAll((node) => node.type === "RNSVGCircle");
    const radii = circles.map((node) => node.props.r);
    const reach = Math.max(...SUN_GLYPH.rays.lengths) * scale;

    expect(radii).toEqual([SUN_GLYPH.bloom * scale, SUN_GLYPH.core * scale]);
    expect(screen.getByTestId(SKY_PART.SUN_RAYS)).toHaveStyle({ width: reach * 2 });
  });

  it("draws at full size by default", async () => {
    await renderWithTheme(<SunGlyph cx={50} cy={50} width={300} height={200} reduced />);
    const circles = screen.container.queryAll((node) => node.type === "RNSVGCircle");

    expect(circles.map((node) => node.props.r)).toEqual([SUN_GLYPH.bloom, SUN_GLYPH.core]);
  });
});

describe("SunGlyph turn", () => {
  /** The share of a turn the rays stood at when they last stopped. */
  const STOPPED_AT = 0.25;
  type Leg = {
    duration: number | undefined;
    end: Parameters<Animated.CompositeAnimation["start"]>[0];
  };
  let legs: Leg[];
  let loops: jest.SpyInstance;

  const Sun = ({ reduced = false }: { reduced?: boolean }) => (
    <SunGlyph cx={50} cy={50} width={300} height={200} reduced={reduced} />
  );

  /** The rays say they stopped at `at` once the test runs `later`. */
  const stoppedAt = (at: number) => {
    let report: () => void = () => {};
    jest.spyOn(Animated.Value.prototype, "stopAnimation").mockImplementation((done) => {
      report = () => done?.(at);
    });
    return { later: () => report() };
  };

  beforeEach(() => {
    legs = [];
    const timing = Animated.timing;
    // Jest never runs a native-driver leg; each one ends when a test says so.
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      const leg = timing(value, config);
      return {
        ...leg,
        start: (end) => {
          legs.push({ duration: config.duration, end });
        },
      };
    });
    loops = jest.spyOn(Animated, "loop");
  });
  afterEach(() => jest.restoreAllMocks());

  it("turns whole turns from rest", async () => {
    const { later } = stoppedAt(0);
    await renderWithTheme(<Sun />);
    later();

    expect(loops).toHaveBeenCalledTimes(1);
    expect(legs).toEqual([]);
  });

  // A native loop goes back to the angle it began at on every turn.
  it("ends the turn it stopped in, then turns whole turns from 0", async () => {
    const { later } = stoppedAt(STOPPED_AT);
    const set = jest.spyOn(Animated.Value.prototype, "setValue");
    await renderWithTheme(<Sun />);
    later();

    expect(legs.map((leg) => leg.duration)).toEqual([(1 - STOPPED_AT) * SUN_GLYPH.spinMs]);
    expect(loops).not.toHaveBeenCalled();

    await act(() => legs[0].end?.({ finished: true }));

    expect(set).toHaveBeenCalledWith(0);
    expect(loops).toHaveBeenCalledTimes(1);
  });

  it("starts no turn once paused before it reads where it stopped", async () => {
    const { later } = stoppedAt(STOPPED_AT);
    const { rerender } = await renderWithTheme(<Sun />);

    await rerender(<Sun reduced />);
    later();

    expect(legs).toEqual([]);
    expect(loops).not.toHaveBeenCalled();
  });

  it("starts no whole turns once paused, though the turn it ended in lands", async () => {
    const { later } = stoppedAt(STOPPED_AT);
    const { rerender } = await renderWithTheme(<Sun />);
    later();

    await rerender(<Sun reduced />);
    await act(() => legs[0].end?.({ finished: true }));

    expect(loops).not.toHaveBeenCalled();
  });
});

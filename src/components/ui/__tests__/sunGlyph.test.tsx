import { screen } from "@testing-library/react-native";

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

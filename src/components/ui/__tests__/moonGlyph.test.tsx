import { screen } from "@testing-library/react-native";

import { MoonGlyph } from "@/components/ui/sky-background/MoonGlyph";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { MOON_GLYPH } from "@/constants/Sky";
import { renderWithTheme } from "@/test-helpers/theme";

const hidden = { includeHiddenElements: true };

describe("MoonGlyph", () => {
  it("draws its body and halo at full size by default", async () => {
    await renderWithTheme(<MoonGlyph cx={100} cy={80} phase={0.4} isRTL={false} />);

    expect(screen.getByTestId(SKY_PART.MOON_BODY, hidden).props.r).toBe(MOON_GLYPH.radius);
  });

  // The bowl draws the same moon small: one renderer, two sizes.
  it("draws its body and halo at a scale, still centred where asked", async () => {
    const scale = 12 / MOON_GLYPH.radius;
    await renderWithTheme(<MoonGlyph cx={100} cy={80} phase={0.4} isRTL={false} scale={scale} />);
    const r = MOON_GLYPH.radius * scale;
    const box = 2 * r * MOON_GLYPH.halo.reach;

    expect(screen.getByTestId(SKY_PART.MOON_BODY, hidden).props.r).toBeCloseTo(r);
    expect(screen.getByTestId(SKY_PART.MOON_HALO, hidden).props.r).toBeCloseTo(
      r * MOON_GLYPH.halo.reach
    );
    expect(screen.getByTestId(SKY_PART.MOON, hidden)).toHaveStyle({
      width: box,
      transform: [{ translateX: 100 - box / 2 }, { translateY: 80 - box / 2 }],
    });
  });
});

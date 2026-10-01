import { StyleSheet, Text } from "react-native";
import { screen } from "@testing-library/react-native";

import { SKY_PART } from "@/components/ui/sky-background";
import { SkyHero, SkySwatch } from "@/components/ui/sky-preview";
import { PHASE } from "@/constants/Phase";
import { ADAPTIVE_SWATCH_WEIGHT } from "@/constants/Sky";
import { AppMode } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";
import { skySwatchFor } from "@/utils/sky";

const part = (id: string) => screen.queryAllByTestId(id, { includeHiddenElements: true });
const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe("SkySwatch", () => {
  const renderSwatch = (mode: AppMode, isRTL = false) =>
    renderWithTheme(<SkySwatch bands={skySwatchFor(mode)} hijriDay={3} isRTL={isRTL} />, { isRTL });

  it("paints one small sky per band, none of them the page sky", async () => {
    await renderSwatch(AppMode.ADAPTIVE);

    expect(part(SKY_PART.PREVIEW)).toHaveLength(Object.values(PHASE).length);
    expect(part(SKY_PART.CANVAS)).toHaveLength(0);
  });

  it("gives each band its share of the width", async () => {
    await renderSwatch(AppMode.ADAPTIVE);
    const widths = part(SKY_PART.PAINT).map((paint) => Number(flat(paint).width));
    const weights = Object.values(PHASE).map((phase) => ADAPTIVE_SWATCH_WEIGHT[phase]);

    expect(widths[1] / widths[0]).toBeCloseTo(weights[1] / weights[0]);
  });

  it("holds its suns still", async () => {
    await renderSwatch(AppMode.LIGHT);

    expect(part(SKY_PART.SUN)).toHaveLength(1);
    const rays = [part(SKY_PART.SUN_RAYS)[0].props.style].flat(Infinity);
    expect(rays.some((style) => style && "transform" in style)).toBe(false);
  });

  it("is hidden from the screen reader", async () => {
    await renderSwatch(AppMode.SYSTEM);

    expect(screen.queryAllByTestId(SKY_PART.PREVIEW)).toHaveLength(0);
  });
});

describe("SkyHero", () => {
  it("reads as one element over the page sky, painting none of its own", async () => {
    await renderWithTheme(
      <SkyHero accessibilityLabel="Adaptive, Asr">
        <Text>Asr</Text>
      </SkyHero>
    );

    expect(screen.getByLabelText("Adaptive, Asr")).toHaveProp("accessible", true);
    expect(part(SKY_PART.PAINT)).toHaveLength(0);
  });
});

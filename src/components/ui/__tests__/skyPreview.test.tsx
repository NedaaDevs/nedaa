import { Animated, StyleSheet, Text } from "react-native";
import { screen } from "@testing-library/react-native";

import { SKY_PART } from "@/components/ui/sky-background";
import { SKY_SWATCH_ID, SkyHero, SkySwatch } from "@/components/ui/sky-preview";
import { PHASE } from "@/constants/Phase";
import { ADAPTIVE_SWATCH_WEIGHT, SKY_SWATCH_SIZE, type SkySwatchSize } from "@/constants/Sky";
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

  // A mode's row, the day preview's button and the Today card, from the design.
  it.each([
    [SKY_SWATCH_SIZE.CHOICE, 77, 58, 12],
    [SKY_SWATCH_SIZE.BUTTON, 44, 30, 8],
    [SKY_SWATCH_SIZE.CARD, 52, 40, 8],
  ] as [SkySwatchSize, number, number, number][])(
    "draws the %s size at its frame",
    async (size, width, height, borderRadius) => {
      await renderWithTheme(
        <SkySwatch bands={skySwatchFor(AppMode.ADAPTIVE)} hijriDay={3} isRTL={false} size={size} />
      );

      expect(flat(screen.getByTestId(SKY_SWATCH_ID))).toEqual(
        expect.objectContaining({ width, height, borderTopLeftRadius: borderRadius })
      );
    }
  );

  // Each size shrinks one painted sky, so the swatches read as one sky.
  it("paints the same sky at every size", async () => {
    const paintedWidth = async (size: SkySwatchSize) => {
      const view = await renderWithTheme(
        <SkySwatch bands={skySwatchFor(AppMode.LIGHT)} hijriDay={3} isRTL={false} size={size} />
      );
      const width = Number(flat(part(SKY_PART.PAINT)[0]).width);
      await view.unmount();
      return width;
    };
    const choice = await paintedWidth(SKY_SWATCH_SIZE.CHOICE);

    for (const size of Object.values(SKY_SWATCH_SIZE)) {
      expect(await paintedWidth(size)).toBeCloseTo(choice);
    }
  });

  // Jest never steps a native-driver animation, so the spin is the loop the
  // sun starts, not an angle read back.
  it("holds its suns still", async () => {
    const spins = jest.spyOn(Animated, "loop");
    await renderSwatch(AppMode.LIGHT);
    const started = spins.mock.calls.length;
    spins.mockRestore();

    expect(part(SKY_PART.SUN)).toHaveLength(1);
    expect(started).toBe(0);
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

  // A lone line at the foot of a tall empty frame reads as something missing.
  it.each([
    [false, 153],
    [true, undefined],
  ])("holds its full height unless compact (compact: %s)", async (compact, minHeight) => {
    await renderWithTheme(
      <SkyHero accessibilityLabel="Next, Asr" compact={compact}>
        <Text>Asr</Text>
      </SkyHero>
    );

    expect(flat(screen.getByLabelText("Next, Asr")).minHeight).toBe(minHeight);
  });
});

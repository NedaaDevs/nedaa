import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";
import { withSpring } from "react-native-reanimated";

import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { SPRING } from "@/constants/Motion";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const ID = "indicator";
const TRACK = 320;
const INSET = 4;
const COUNT = 4;

type Spacing = { gap: number; width: number };
/** No gap: (320 - 2 x 4) / 4 = 78. Gap 4: (320 - 2 x 4 - 3 x 4) / 4 = 75. */
const FLUSH: Spacing = { gap: 0, width: 78 };
const SPACED: Spacing = { gap: 4, width: 75 };

const indicator = (index: number, gap: number) => (
  <SlidingIndicator
    testID={ID}
    index={index}
    count={COUNT}
    trackWidth={TRACK}
    inset={INSET}
    gap={gap}
    style={{ backgroundColor: "red" }}
  />
);

const styleOf = () =>
  StyleSheet.flatten(screen.getByTestId(ID, { includeHiddenElements: true }).props.style);
const translateOf = () =>
  (styleOf().transform as { translateX: number }[] | undefined)?.[0]?.translateX;

beforeEach(() => {
  mockReduced = false;
  jest.mocked(withSpring).mockClear();
});

describe("SlidingIndicator", () => {
  it.each([FLUSH, SPACED])("is one item wide, inset from the track (gap $gap)", async (spacing) => {
    await renderWithTheme(indicator(0, spacing.gap));

    expect(styleOf()).toMatchObject({
      position: "absolute",
      width: spacing.width,
      top: INSET,
      bottom: INSET,
      start: INSET,
      backgroundColor: "red",
    });
  });

  it("is hidden from the screen reader", async () => {
    await renderWithTheme(indicator(0, 0));

    expect(screen.queryByTestId(ID)).toBeNull();
  });

  it.each([0, 1, 2, 3])("sits under item %s, counted from the start", async (index) => {
    await renderWithTheme(indicator(index, SPACED.gap));

    expect(translateOf()).toBe(index * (SPACED.width + SPACED.gap));
  });

  // Placed from the start edge, so RTL runs the other way.
  it.each([0, 1, 2, 3])("sits under item %s in RTL", async (index) => {
    await renderWithTheme(indicator(index, FLUSH.gap), { isRTL: true });

    expect(translateOf()).toBe(0 - index * FLUSH.width);
  });

  it("jumps to its first place and slides to a new one on the snap spring", async () => {
    const { rerender } = await renderWithTheme(indicator(0, 0));

    expect(withSpring).not.toHaveBeenCalled();

    await rerender(indicator(2, 0));

    expect(withSpring).toHaveBeenCalledWith(2 * FLUSH.width, SPRING.SNAP);
    expect(translateOf()).toBe(2 * FLUSH.width);
  });

  it("jumps under reduced motion", async () => {
    mockReduced = true;
    const { rerender } = await renderWithTheme(indicator(0, 0));

    await rerender(indicator(3, 0));

    expect(withSpring).not.toHaveBeenCalled();
    expect(translateOf()).toBe(3 * FLUSH.width);
  });

  it("jumps when the track is resized", async () => {
    const { rerender } = await renderWithTheme(indicator(1, 0));

    await rerender(
      <SlidingIndicator
        testID={ID}
        index={1}
        count={COUNT}
        trackWidth={TRACK + 40}
        inset={INSET}
        gap={0}
      />
    );

    expect(withSpring).not.toHaveBeenCalled();
    expect(translateOf()).toBe(88);
  });
});

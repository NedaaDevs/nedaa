import { View } from "react-native";
import { fireEvent, screen, userEvent, within } from "@testing-library/react-native";

import { BUTTON_PAIR_PART, ButtonPair, type PairAction } from "@/components/ui/button-pair";
import { pairFits } from "@/components/ui/button-pair/fit";
import { controlProblems } from "@/test-helpers/controls";
import { GLYPH_ID, Glyph } from "@/test-helpers/glyph";
import { renderWithTheme } from "@/test-helpers/theme";

const SECONDARY: PairAction = { label: "Keep Riyadh", onPress: jest.fn() };

const pair = (primary: Partial<PairAction> = {}, secondary: Partial<PairAction> = {}) => (
  <ButtonPair
    primary={{ label: "Use Jeddah", onPress: jest.fn(), ...primary }}
    secondary={{ ...SECONDARY, ...secondary }}
  />
);

const renderPair = (primary: Partial<PairAction> = {}) => renderWithTheme(pair(primary));

const layoutOf = (width: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height: 50 } },
});

/** Lays out the row and both hidden label copies, as the native pass would. */
const measure = async (row: number, labels: readonly [number, number]) => {
  await fireEvent(screen.getByTestId(BUTTON_PAIR_PART.ROW), "layout", layoutOf(row));
  const copies = screen.getAllByTestId(BUTTON_PAIR_PART.MEASURE, { includeHiddenElements: true });
  for (const [i, copy] of copies.entries()) await fireEvent(copy, "layout", layoutOf(labels[i]));
};

describe("pairFits", () => {
  it.each([
    [{ rowWidth: 350, gap: 8, inset: 20, labels: [90, 110] as const }, true],
    [{ rowWidth: 350, gap: 8, inset: 20, labels: [90, 140] as const }, false],
    [{ rowWidth: 0, gap: 8, inset: 20, labels: [10, 10] as const }, false],
  ])("fits %o: %s", (fit, fits) => expect(pairFits(fit)).toBe(fits));
});

describe("ButtonPair", () => {
  it("draws an action's icon in its button and in the copy the fit measures", async () => {
    await renderPair({ icon: Glyph });

    const lead = screen.getByRole("button", { name: "Use Jeddah" });
    expect(within(lead).getByTestId(GLYPH_ID, { includeHiddenElements: true })).toBeTruthy();
    const [copy] = screen.getAllByTestId(BUTTON_PAIR_PART.MEASURE, { includeHiddenElements: true });
    expect(within(copy).getByTestId(GLYPH_ID, { includeHiddenElements: true })).toBeTruthy();
  });

  it("stacks, primary first, until both labels are measured", async () => {
    await renderPair();

    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "column" });
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "Use Jeddah",
      "Keep Riyadh",
    ]);
  });

  it("stays stacked while a label is unmeasured", async () => {
    await renderPair();
    await fireEvent(screen.getByTestId(BUTTON_PAIR_PART.ROW), "layout", layoutOf(350));

    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "column" });
  });

  it("sets the pair side by side, primary at the start, once both labels fit", async () => {
    await renderPair();
    await measure(350, [90, 110]);

    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "row" });
    // Primary first in a row; React Native flips the row for RTL.
    expect(screen.getAllByRole("button")[0]).toHaveProp("accessibilityLabel", "Use Jeddah");
  });

  it("stacks again when the text grows past half the row", async () => {
    await renderPair();
    await measure(350, [90, 110]);
    await measure(350, [90, 160]);

    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "column" });
  });

  it("measures again when a label changes", async () => {
    const { rerender } = await renderPair();
    await measure(350, [90, 110]);
    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "row" });

    await rerender(pair({ label: "Use Jeddah and update every prayer" }));
    await measure(350, [260, 110]);

    expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "column" });
    expect(screen.getByRole("button", { name: "Use Jeddah and update every prayer" })).toBeTruthy();
  });

  // Host views that can be read at once give the first frame its direction.
  it("reads the sizes before the first paint when the host can", async () => {
    const widths: Record<string, number> = {
      [BUTTON_PAIR_PART.ROW]: 350,
      [BUTTON_PAIR_PART.MEASURE]: 100,
    };
    const proto = View.prototype as unknown as Record<string, unknown>;
    proto.getBoundingClientRect = function (this: { props: { testID: string } }) {
      return { width: widths[this.props.testID] ?? 0 };
    };
    try {
      await renderPair();

      expect(screen.getByTestId(BUTTON_PAIR_PART.ROW)).toHaveStyle({ flexDirection: "row" });
    } finally {
      delete proto.getBoundingClientRect;
    }
  });

  it("says a disabled button's state and holds it still", async () => {
    const onPress = jest.fn();
    await renderPair({ label: "Use Jeddah", onPress, disabled: true });

    const use = screen.getByRole("button", { name: "Use Jeddah" });
    expect(use).toBeDisabled();
    await userEvent.press(use);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("presses the action it was given", async () => {
    const onPress = jest.fn();
    await renderPair({ onPress });

    await userEvent.press(screen.getByRole("button", { name: "Use Jeddah" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("gives both buttons a role, a name and a 44pt target", async () => {
    await renderPair();

    expect(controlProblems()).toEqual([]);
  });

  it("hides the measuring copies from the reader", async () => {
    await renderPair();

    expect(screen.queryAllByRole("button")).toHaveLength(2);
    for (const copy of screen.getAllByTestId(BUTTON_PAIR_PART.MEASURE, {
      includeHiddenElements: true,
    })) {
      expect(copy).toHaveProp("accessibilityElementsHidden", true);
      expect(copy).toHaveProp("importantForAccessibility", "no-hide-descendants");
      expect(copy).toHaveProp("pointerEvents", "none");
    }
  });
});

import { screen, userEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { COUNT_RING_PART, CountRing } from "@/components/athkar/looks/classic/CountRing";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Count";
const CIRCLE = "RNSVGCircle";

type Options = {
  count?: number;
  target?: number;
  disabled?: boolean;
  held?: boolean;
  onPress?: () => void;
};

const renderRing = ({
  count = 1,
  target = 3,
  disabled = false,
  held = false,
  onPress = jest.fn(),
}: Options) =>
  renderWithTheme(
    <CountRing
      count={count}
      target={target}
      countText={String(count)}
      targetText={String(target)}
      valueText={`${count} / ${target}`}
      disabled={disabled}
      held={held}
      hint="Tap to count"
      accessibilityLabel={LABEL}
      onPress={onPress}
    />
  );

/** The share of the circumference the arc paints. */
const drawnFraction = () => {
  const [, arc] = screen.container.queryAll((node) => node.type === CIRCLE);
  return 1 - arc.props.strokeDashoffset / arc.props.strokeDasharray[0];
};

/** How many digit slots hold the number's width. The reader skips them. */
const reservedDigits = () =>
  screen.getAllByTestId(COUNT_RING_PART.DIGIT_SIZER, { includeHiddenElements: true }).length;

const ring = () => screen.getByRole("button", { name: LABEL });
/** How solid the ring is drawn; 1 when the style names no opacity. */
const ringOpacity = () => StyleSheet.flatten(ring().props.style).opacity ?? 1;

describe("CountRing", () => {
  it("counts on a press", async () => {
    const onPress = jest.fn();
    await renderRing({ onPress });
    await userEvent.press(screen.getByRole("button", { name: LABEL }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("tells the reader the count and the target", async () => {
    await renderRing({ count: 2, target: 3 });
    expect(screen.getByRole("button", { name: LABEL })).toHaveAccessibilityValue({ text: "2 / 3" });
  });

  it("closes the ring at the target", async () => {
    await renderRing({ count: 1, target: 1 });
    expect(drawnFraction()).toBeCloseTo(1);
  });

  it("draws a third of the ring at one of three", async () => {
    await renderRing({ count: 1, target: 3 });
    expect(drawnFraction()).toBeCloseTo(1 / 3);
  });

  it.each([1, 99, 100])("holds the target's width at count %s", async (count) => {
    await renderRing({ count, target: 100 });
    expect(reservedDigits()).toBe(3);
  });

  it("does not count while disabled, and says so", async () => {
    const onPress = jest.fn();
    await renderRing({ disabled: true, onPress });
    const ring = screen.getByRole("button", { name: LABEL });
    await userEvent.press(ring);
    expect(onPress).not.toHaveBeenCalled();
    expect(ring).toBeDisabled();
  });

  it("does not count while held, and keeps its look", async () => {
    const onPress = jest.fn();
    await renderRing({ onPress });
    const idle = ringOpacity();
    await renderRing({ held: true, onPress });
    await userEvent.press(ring());
    expect(onPress).not.toHaveBeenCalled();
    expect(ring()).toBeDisabled();
    expect(ringOpacity()).toBe(idle);
  });

  it("dims while disabled", async () => {
    await renderRing({});
    const idle = ringOpacity();
    await renderRing({ disabled: true });
    expect(ringOpacity()).toBeLessThan(idle);
  });
});

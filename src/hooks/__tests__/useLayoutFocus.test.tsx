import { AccessibilityInfo, View } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { useLayoutFocus } from "@/hooks/useLayoutFocus";

const TARGET = "layout-focus-target";
const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 44, height: 44 } } };

/** A view that takes reader focus from its layout, once per `focusKey`. */
const Target = ({ focusKey }: { focusKey?: number }) => {
  const { ref, onLayout } = useLayoutFocus(focusKey);
  return <View ref={ref} testID={TARGET} accessible onLayout={onLayout} />;
};

const layOut = () => act(async () => fireEvent(screen.getByTestId(TARGET), "layout", LAYOUT));
const focusOnTarget = () =>
  expect.objectContaining({ props: expect.objectContaining({ testID: TARGET }) });

describe("useLayoutFocus", () => {
  let focus: jest.SpyInstance;
  beforeEach(() => {
    focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    // The preset's mock is shared, so calls from earlier suites stay on it.
    focus.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  // A view mounted in this commit may have no native view for the event yet.
  it("moves no focus before the view's layout, and once after it", async () => {
    await render(<Target />);
    expect(focus).not.toHaveBeenCalled();

    await layOut();
    await layOut();

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(focusOnTarget(), "focus");
  });

  it("focuses again at the next layout once the key changes", async () => {
    await render(<Target focusKey={1} />);
    await layOut();

    await screen.rerender(<Target focusKey={1} />);
    await layOut();
    expect(focus).toHaveBeenCalledTimes(1);

    await screen.rerender(<Target focusKey={2} />);
    expect(focus).toHaveBeenCalledTimes(1);
    await layOut();
    expect(focus).toHaveBeenCalledTimes(2);
  });
});

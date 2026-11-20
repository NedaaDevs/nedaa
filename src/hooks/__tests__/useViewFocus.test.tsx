import { AccessibilityInfo, View } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { useLayoutFocus } from "@/hooks/useLayoutFocus";
import { useViewFocus } from "@/hooks/useViewFocus";
import { layOut } from "@/test-helpers/layout";

const HEADING = "view-focus-heading";
/** How the heading draws across views: one per view, or one for all. */
const HEADING_DRAW = { PER_VIEW: "per-view", SHARED: "shared" } as const;
type HeadingDraw = (typeof HEADING_DRAW)[keyof typeof HEADING_DRAW];

/** A step whose heading takes reader focus on each change of `view`. */
const Step = ({ view, draw }: { view: number | null; draw: HeadingDraw }) => {
  const { ref, onLayout, focus } = useLayoutFocus();
  useViewFocus(view, focus);
  return (
    <View
      key={draw === HEADING_DRAW.PER_VIEW ? String(view) : draw}
      ref={ref}
      testID={HEADING}
      accessible
      onLayout={onLayout}
    />
  );
};

const layOutHeading = () => layOut(screen.getByTestId(HEADING));
const onHeading = () =>
  expect.objectContaining({ props: expect.objectContaining({ testID: HEADING }) });

describe("useViewFocus", () => {
  let focus: jest.SpyInstance;
  beforeEach(() => {
    focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    // The preset's mock is shared, so calls from earlier suites stay on it.
    focus.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  // A heading mounted with the view has no native view until it is laid out.
  it("focuses a heading drawn anew at its first layout, not before", async () => {
    await render(<Step view={1} draw={HEADING_DRAW.PER_VIEW} />);
    await layOutHeading();

    await screen.rerender(<Step view={2} draw={HEADING_DRAW.PER_VIEW} />);
    expect(focus).not.toHaveBeenCalled();
    await layOutHeading();
    await layOutHeading();

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(onHeading(), "focus");
  });

  it("focuses a heading that stays on screen at once", async () => {
    await render(<Step view={1} draw={HEADING_DRAW.SHARED} />);
    await layOutHeading();

    await screen.rerender(<Step view={2} draw={HEADING_DRAW.SHARED} />);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(onHeading(), "focus");
  });

  // The arrival is the flow's to focus.
  it.each(Object.values(HEADING_DRAW))(
    "moves nothing for the first view after a null (%s heading)",
    async (draw) => {
      await render(<Step view={null} draw={draw} />);
      await layOutHeading();

      await screen.rerender(<Step view={1} draw={draw} />);
      await layOutHeading();

      expect(focus).not.toHaveBeenCalled();
    }
  );
});

import { screen } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import { FOCUS_ORBIT_PART, FocusOrbit } from "@/components/athkar/looks/classic/FocusOrbit";
import { FOCUS_MOTION } from "@/constants/AthkarFocus";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

type Props = Parameters<typeof FocusOrbit>[0];

/** The orbit at rest: no hold, no drag. */
const Orbit = (over: Partial<Props>) => {
  const still = useSharedValue(0);
  return (
    <FocusOrbit
      count={4}
      target={33}
      countText="4"
      targetText="33"
      targetLine="of 33"
      change={null}
      armed={false}
      canUndo
      reduceMotion={false}
      hold={still}
      side={still}
      down={still}
      {...over}
    />
  );
};
const orbit = (over: Partial<Props> = {}) => <Orbit {...over} />;

describe("FocusOrbit", () => {
  it("writes the count and the target line", async () => {
    await renderWithTheme(orbit());
    expect(screen.getByText("4")).toBeOnTheScreen();
    expect(screen.getByText("of 33")).toBeOnTheScreen();
  });

  it("reserves the width of the target's digits", async () => {
    await renderWithTheme(orbit());
    expect(
      screen.getAllByTestId(FOCUS_ORBIT_PART.DIGIT_SIZER, { includeHiddenElements: true })
    ).toHaveLength(2);
  });

  it("writes the pending change above the number", async () => {
    await renderWithTheme(orbit({ change: "+3" }));
    expect(screen.getByText("+3")).toBeOnTheScreen();
  });

  it("dims the number while a release would undo", async () => {
    await renderWithTheme(orbit({ armed: true }));
    expect(screen.getByText("4")).toHaveStyle({ opacity: FOCUS_MOTION.ARMED_OPACITY });
  });
});

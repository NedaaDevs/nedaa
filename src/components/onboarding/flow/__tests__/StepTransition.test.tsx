import { act } from "@testing-library/react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { StepTransition, enterOffset } from "@/components/onboarding/flow/StepTransition";
import {
  ONBOARDING_PART,
  STEP_DIRECTION,
  STEP_MOTION,
  type StepDirection,
} from "@/constants/Onboarding";
import { RTLProvider } from "@/contexts/RTLContext";
import { AppLocale } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/stores/app";
import { renderWithTheme } from "@/test-helpers/theme";

// The entry state shows as the starting values of the shared values.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("@/test-helpers/reanimatedMock");
  return { __esModule: true, ...actual, useSharedValue: jest.fn(actual.useSharedValue) };
});
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));

const { FORWARD, BACK } = STEP_DIRECTION;
const PX = STEP_MOTION.ENTER_PX;
// Opaque keys: the flow keys the transition by step.
const FIRST_KEY = "first";
const NEXT_KEY = "next";

const Transition = ({
  stepKey,
  direction = FORWARD,
}: {
  stepKey: string;
  direction?: StepDirection;
}) => (
  <RTLProvider>
    <StepTransition key={stepKey} direction={direction}>
      {null}
    </StepTransition>
  </RTLProvider>
);
/** The durations of the entry's animations, in the order they start. */
const durations = () => jest.mocked(withTiming).mock.calls.map(([, config]) => config?.duration);

beforeEach(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(withTiming).mockClear();
  jest.mocked(useSharedValue).mockClear();
});

// Forward enters from the reading start; translateX is physical.
it.each([
  [FORWARD, false, -PX],
  [BACK, false, PX],
  [FORWARD, true, PX],
  [BACK, true, -PX],
] as const)("enters direction %s, rtl %s, from %spx", (direction, rtl, expected) => {
  expect(enterOffset(direction, rtl)).toBe(expected);
});

it("mounts at the entry state, then moves into place", async () => {
  const view = await renderWithTheme(<Transition stepKey={FIRST_KEY} />);

  expect(useSharedValue).toHaveBeenNthCalledWith(1, enterOffset(FORWARD, false));
  expect(useSharedValue).toHaveBeenNthCalledWith(2, 0);
  expect(withTiming).toHaveBeenCalledWith(0, expect.anything());
  expect(withTiming).toHaveBeenCalledWith(1, expect.anything());
  expect(view.getByTestId(ONBOARDING_PART.TRANSITION)).toHaveStyle({
    opacity: 1,
    transform: [{ translateX: 0 }],
  });
});

it("does not replay on a language change, and enters the next step from its start", async () => {
  const view = await renderWithTheme(<Transition stepKey={FIRST_KEY} />);
  jest.mocked(withTiming).mockClear();

  await act(async () => useAppStore.setState({ locale: AppLocale.AR }));
  expect(withTiming).not.toHaveBeenCalled();
  jest.mocked(useSharedValue).mockClear();

  await view.rerender(<Transition stepKey={NEXT_KEY} />);
  expect(useSharedValue).toHaveBeenCalledWith(enterOffset(FORWARD, true));
  expect(withTiming).toHaveBeenCalledWith(0, expect.anything());
});

it.each([
  [FORWARD, STEP_MOTION.FORWARD_MS],
  [BACK, STEP_MOTION.BACK_MS],
] as const)("moves and fades in together, direction %s, over %sms", async (direction, ms) => {
  await renderWithTheme(<Transition stepKey={FIRST_KEY} direction={direction} />);

  expect(durations()).toEqual([ms, ms]);
});

describe("under Reduce Motion", () => {
  beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(true));

  it("only fades going forward, within the reduced time", async () => {
    await renderWithTheme(<Transition stepKey={FIRST_KEY} />);

    expect(useSharedValue).toHaveBeenNthCalledWith(1, 0);
    expect(withTiming).not.toHaveBeenCalledWith(-PX, expect.anything());
    expect(withTiming).not.toHaveBeenCalledWith(PX, expect.anything());
    expect(withTiming).toHaveBeenCalledWith(1, expect.anything());
    expect(durations()).toEqual([STEP_MOTION.REDUCED_MS]);
  });

  it("shows the step at once going back", async () => {
    const view = await renderWithTheme(<Transition stepKey={FIRST_KEY} direction={BACK} />);

    expect(withTiming).not.toHaveBeenCalled();
    expect(view.getByTestId(ONBOARDING_PART.TRANSITION)).toHaveStyle({ opacity: 1 });
  });
});

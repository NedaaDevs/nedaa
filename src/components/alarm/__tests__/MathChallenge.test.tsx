import { AccessibilityInfo } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import MathChallenge from "@/components/alarm/challenges/MathChallenge";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const DIFFICULTY = CHALLENGE_DIFFICULTY.EASY;
const WRONG = t("alarm.challenge.wrongAnswer");
// What the seeded random numbers below draw on the easy level.
const FIRST = t("a11y.alarm.mathProblem", { num1: 1, operation: "+", num2: 1 });
const NEXT = t("a11y.alarm.mathProblem", { num1: 6, operation: "−", num2: 6 });
const STRIKES = 3;

// Queued lines only: the keyboard's close moves focus and would cut any other.
const said = () =>
  jest
    .mocked(AccessibilityInfo.announceForAccessibilityWithOptions)
    .mock.calls.filter(([, options]) => options.queue)
    .map(([message]) => message);

const renderChallenge = async () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  await renderWithTheme(<MathChallenge difficulty={DIFFICULTY} onComplete={jest.fn()} />);
  random.mockReturnValue(0.5);
};

const miss = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.clear(screen.getByLabelText(t("alarm.challenge.enterAnswer")));
  await user.type(screen.getByLabelText(t("alarm.challenge.enterAnswer")), "99");
  await user.press(screen.getByRole("button", { name: t("alarm.challenge.submit") }));
};

describe("MathChallenge", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("reads the problem box as one element", async () => {
    await renderChallenge();

    expect(screen.getByLabelText(FIRST)).toHaveProp("accessible", true);
  });

  it("says a miss once, on either platform", async () => {
    await renderChallenge();

    await miss(userEvent.setup());

    expect(said()).toEqual([WRONG]);
    // A live region here would say it a second time on Android.
    expect(screen.getByText(WRONG)).not.toHaveProp("accessibilityLiveRegion");
    expect(screen.getByLabelText(FIRST)).not.toHaveProp("accessibilityLiveRegion");
  });

  it("says the new problem in the same sentence as the miss that brought it", async () => {
    await renderChallenge();
    const user = userEvent.setup();

    for (let strike = 0; strike < STRIKES; strike++) await miss(user);

    expect(said()).toEqual([WRONG, WRONG, t("a11y.alarm.newProblem", { problem: NEXT })]);
    expect(screen.getByLabelText(NEXT)).toBeOnTheScreen();
  });
});

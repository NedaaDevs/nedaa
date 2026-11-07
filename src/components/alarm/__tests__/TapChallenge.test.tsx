import { AccessibilityInfo } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import TapChallenge from "@/components/alarm/challenges/TapChallenge";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { CHALLENGE_DIFFICULTY_CONFIG } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const DIFFICULTY = CHALLENGE_DIFFICULTY.EASY;
const TAPS = CHALLENGE_DIFFICULTY_CONFIG.tap[DIFFICULTY].taps;

const remaining = (count: number) => t("a11y.alarm.tapsRemaining", { count });
const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const tapButton = () => screen.getByRole("button", { name: t("alarm.challenge.tapToDismiss") });

// Jest runs as iOS, which has no live regions.
describe("TapChallenge", () => {
  beforeEach(() => jest.clearAllMocks());

  it("says the taps left after each tap", async () => {
    await renderWithTheme(<TapChallenge difficulty={DIFFICULTY} onComplete={jest.fn()} />);
    expect(said()).toEqual([remaining(TAPS)]);

    await userEvent.press(tapButton());

    expect(said()).toEqual([remaining(TAPS), remaining(TAPS - 1)]);
  });

  it("says no count once the last tap finishes the challenge", async () => {
    const onComplete = jest.fn();
    await renderWithTheme(<TapChallenge difficulty={DIFFICULTY} onComplete={onComplete} />);
    const user = userEvent.setup();

    for (let tap = 0; tap < TAPS; tap++) await user.press(tapButton());

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(said()).not.toContain(remaining(0));
  });
});

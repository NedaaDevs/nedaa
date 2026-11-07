import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY, CHALLENGE_TYPE } from "expo-alarm";

import ChallengeWrapper, { GRACE_STATUS_ID } from "@/components/alarm/challenges/ChallengeWrapper";
import i18n from "@/localization/i18n";
import { layOut } from "@/test-helpers/layout";
import { renderWithTheme } from "@/test-helpers/theme";
import { GRACE_PERIOD_SECONDS, type ChallengeConfig } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const CONFIG: ChallengeConfig = {
  type: CHALLENGE_TYPE.TAP,
  difficulty: CHALLENGE_DIFFICULTY.EASY,
  count: 1,
};
const GRACE_MS = GRACE_PERIOD_SECONDS[CONFIG.type][CONFIG.difficulty] * 1000;
const FINAL_STRETCH_MS = 5000;
const TICK_MS = 200;

const WARNING = t("a11y.alarm.graceFinalWarning");
const EXPIRED = t("alarm.grace.expired");

const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const start = async () => {
  await renderWithTheme(<ChallengeWrapper config={CONFIG} onAllComplete={jest.fn()} />);
  await userEvent
    .setup()
    .press(screen.getByRole("button", { name: t("alarm.challenge.startSolving") }));
};

describe("ChallengeWrapper", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  // Jest runs as iOS, which has no live regions.
  it("says the final warning, then that the grace ended", async () => {
    await start();
    await advance(GRACE_MS - FINAL_STRETCH_MS - TICK_MS);
    expect(said()).not.toContain(WARNING);

    await advance(2 * TICK_MS);
    expect(said()).toContain(WARNING);
    expect(said()).not.toContain(EXPIRED);

    await advance(FINAL_STRETCH_MS);
    expect(said()).toContain(EXPIRED);
  });

  // Android speaks only a change on a view it already knows.
  it("holds the expiry's live region mounted before its message", async () => {
    await start();
    const region = screen.getByTestId(GRACE_STATUS_ID);
    await layOut(region);
    expect(region).toHaveProp("accessibilityLabel", "");

    await advance(GRACE_MS + TICK_MS);

    expect(screen.getByTestId(GRACE_STATUS_ID)).toBe(region);
    expect(region).toHaveProp("accessibilityLabel", EXPIRED);
  });
});

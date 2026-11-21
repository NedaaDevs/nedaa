import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import EmergencyQuiet from "@/components/alarm/challenges/EmergencyQuiet";
import {
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_MINUTES,
  EMERGENCY_QUIET_PART,
  QUIET_CONFIRM_WAIT_SECONDS,
  SECOND_MS,
} from "@/constants/EmergencyQuiet";
import type { EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useQuietOffer } from "@/hooks/useQuietOffer";
import i18n from "@/localization/i18n";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import { quietControl } from "@/test-helpers/quietControl";
import { renderWithTheme } from "@/test-helpers/theme";
import {
  NEW_QUIET_LEDGER,
  recordUse,
  setAllowance,
  type QuietLedger,
} from "@/utils/emergencyQuiet";

const t = i18n.t.bind(i18n);
const NOW = new Date(2026, 10, 21, 5);
// The countdown numeral is hidden from the reader, which hears the ready line.
const HIDDEN = { includeHiddenElements: true };

const BUTTON = t("alarm.quiet.button");
const GO = t("alarm.quiet.confirm.go");
const BACK = t("common.back");
const READY = t("a11y.alarm.quiet.ready", { go: GO });
const FAILED = t("alarm.quiet.failed");

const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const setUp = async (
  overrides: Partial<EmergencyQuietControl> = {},
  { wayOut = false, ledger = NEW_QUIET_LEDGER }: { wayOut?: boolean; ledger?: QuietLedger } = {}
) => {
  useEmergencyQuietStore.setState({ ledger });
  const control = quietControl(overrides);
  const view = await renderWithTheme(<Quiet control={control} wayOut={wayOut} />);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  return { ...view, control, user };
};

/** The offer read once, as a screen reads it. */
const Quiet = ({ control, wayOut }: { control: EmergencyQuietControl; wayOut: boolean }) => (
  <EmergencyQuiet control={control} offer={useQuietOffer(control, wayOut)} />
);

const usedUp = (): QuietLedger => {
  const one = setAllowance(NEW_QUIET_LEDGER, EMERGENCY_QUIET_ALLOWANCE.ONE, NOW.getTime());
  return recordUse(one, NOW.getTime()) ?? one;
};

describe("EmergencyQuiet", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("offers the quiet as a button that asks to confirm", async () => {
    const { control, user } = await setUp();

    const button = screen.getByRole("button", { name: BUTTON });
    expect(button).toHaveProp("accessibilityHint", t("a11y.alarm.quiet.buttonHint"));
    await user.press(button);

    expect(control.open).toHaveBeenCalledTimes(1);
    expect(control.confirm).not.toHaveBeenCalled();
  });

  it('keeps "Quiet now" disabled for the wait, counting it down', async () => {
    const { control, user } = await setUp({ confirming: true });

    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    expect(screen.getByRole("header", { name: t("alarm.quiet.confirm.title") })).toBeVisible();
    expect(
      screen.getByText(t("alarm.quiet.confirm.body", { count: EMERGENCY_QUIET_MINUTES }))
    ).toBeVisible();
    expect(screen.getByText(t("alarm.quiet.confirm.cost"))).toBeVisible();
    expect(screen.getByTestId(EMERGENCY_QUIET_PART.WAIT, HIDDEN)).toHaveTextContent(
      String(QUIET_CONFIRM_WAIT_SECONDS)
    );
    const go = screen.getByRole("button", { name: GO });
    expect(go).toBeDisabled();
    await user.press(go);
    expect(control.confirm).not.toHaveBeenCalled();

    await advance(SECOND_MS);
    expect(screen.getByTestId(EMERGENCY_QUIET_PART.WAIT, HIDDEN)).toHaveTextContent(
      String(QUIET_CONFIRM_WAIT_SECONDS - 1)
    );
    expect(said()).not.toContain(READY);

    await advance((QUIET_CONFIRM_WAIT_SECONDS - 1) * SECOND_MS);
    expect(screen.queryByTestId(EMERGENCY_QUIET_PART.WAIT, HIDDEN)).toBeNull();
    expect(said()).toContain(READY);
    expect(go).toBeEnabled();
    await user.press(go);

    expect(control.confirm).toHaveBeenCalledTimes(1);
  });

  it("goes back without quieting", async () => {
    const { control, user } = await setUp({ confirming: true });

    await user.press(screen.getByRole("button", { name: BACK }));

    expect(control.back).toHaveBeenCalledTimes(1);
    expect(control.confirm).not.toHaveBeenCalled();
  });

  it("hands the reader back to the button after Back", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const { control, user, rerender } = await setUp({ confirming: true });

    await user.press(screen.getByRole("button", { name: BACK }));
    focus.mockClear();
    await rerender(<Quiet control={{ ...control, confirming: false }} wayOut={false} />);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), "focus");
    expect(screen.getByRole("button", { name: BUTTON })).toBeVisible();
  });

  it("leaves the reader where it is when the button first shows", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");

    await setUp();

    expect(focus).not.toHaveBeenCalled();
  });

  it("closes the confirm once the way out takes the offer away", async () => {
    const { control, rerender } = await setUp({ confirming: true });

    await rerender(<Quiet control={control} wayOut />);

    expect(screen.queryByTestId(EMERGENCY_QUIET_PART.CONFIRM)).toBeNull();
  });

  it("takes no second press while quieting", async () => {
    const { control, user } = await setUp({ confirming: true, quieting: true });
    await advance(QUIET_CONFIRM_WAIT_SECONDS * SECOND_MS);

    const go = screen.getByRole("button", { name: GO });
    expect(go).toBeDisabled();
    await user.press(go);

    expect(control.confirm).not.toHaveBeenCalled();
  });

  it("says a failed quiet counted nothing, in place of the cost", async () => {
    await setUp({ confirming: true, failed: true });

    expect(screen.getByTestId(EMERGENCY_QUIET_PART.FAILED)).toHaveTextContent(FAILED);
    expect(screen.queryByText(t("alarm.quiet.confirm.cost"))).toBeNull();
    expect(said()).toContain(FAILED);
  });

  it("says when the next quiet comes once the month's are spent", async () => {
    await setUp({}, { ledger: usedUp() });

    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    expect(screen.getByTestId(EMERGENCY_QUIET_PART.NONE_LEFT)).toHaveTextContent(
      t("alarm.quiet.noneLeft", { date: "1 December" })
    );
  });

  it("says this alarm's quiet was used", async () => {
    await setUp({ used: true });

    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    expect(screen.getByTestId(EMERGENCY_QUIET_PART.USED)).toHaveTextContent(t("alarm.quiet.used"));
  });

  it.each<[string, Partial<EmergencyQuietControl>, { wayOut?: boolean; ledger?: QuietLedger }]>([
    ["the way out is showing", { confirming: true }, { wayOut: true }],
    ["the alarm is a preview", { preview: true }, {}],
    ["the alarm is snoozed", { snoozed: true }, {}],
    ["the alarm has no task", { hasTask: false }, {}],
    ["the quiet is running", { quietUntil: NOW.getTime() + SECOND_MS }, {}],
    [
      "the allowance is off",
      {},
      { ledger: setAllowance(NEW_QUIET_LEDGER, EMERGENCY_QUIET_ALLOWANCE.OFF, NOW.getTime()) },
    ],
  ])("shows nothing while %s", async (_name, overrides, options) => {
    await setUp(overrides, options);

    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    expect(screen.queryByTestId(EMERGENCY_QUIET_PART.CONFIRM)).toBeNull();
    expect(screen.queryByTestId(EMERGENCY_QUIET_PART.NONE_LEFT)).toBeNull();
    expect(screen.queryByTestId(EMERGENCY_QUIET_PART.USED)).toBeNull();
  });
});

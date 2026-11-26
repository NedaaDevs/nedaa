import { AccessibilityInfo } from "react-native";
import { screen } from "@testing-library/react-native";

import QuietBanner, { QuietStatus } from "@/components/alarm/challenges/QuietBanner";
import { EMERGENCY_QUIET_MS, EMERGENCY_QUIET_PART } from "@/constants/EmergencyQuiet";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);
const NOW = new Date(2026, 10, 21, 5, 0);
const UNTIL = NOW.getTime() + EMERGENCY_QUIET_MS;

const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();

describe("QuietBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ use24HourTime: true, useWesternNumerals: true });
  });

  it("shows when the alarm rings again", async () => {
    await renderWithTheme(<QuietBanner until={UNTIL} />);

    expect(screen.getByTestId(EMERGENCY_QUIET_PART.BANNER)).toHaveTextContent(
      t("alarm.quiet.banner", { time: "05:05" })
    );
  });

  // The reader's focus says the banner; the status adds nothing to it.
  it("moves the reader to the quiet and its end once", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const view = await renderWithTheme(<QuietStatus quietUntil={null} used={false} />);

    await view.rerender(
      <>
        <QuietBanner until={UNTIL} />
        <QuietStatus quietUntil={UNTIL} used />
      </>
    );

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), "focus");
    expect(said()).toEqual([]);
    expect(screen.getByTestId(EMERGENCY_QUIET_PART.BANNER)).toHaveProp(
      "accessibilityLabel",
      expect.stringMatching(/^Sound off\. Rings again at /)
    );
  });

  it("says the quiet was used as the alarm rings again", async () => {
    const view = await renderWithTheme(<QuietStatus quietUntil={UNTIL} used />);
    jest.clearAllMocks();

    await view.rerender(<QuietStatus quietUntil={null} used />);

    expect(said()).toEqual([t("alarm.quiet.used")]);
  });
});

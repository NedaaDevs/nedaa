import { screen, userEvent } from "@testing-library/react-native";

import EmergencyQuietSettings from "@/components/alarm/EmergencyQuietSettings";
import {
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_MINUTES,
  EMERGENCY_QUIET_PART,
} from "@/constants/EmergencyQuiet";
import i18n from "@/localization/i18n";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import { renderWithTheme } from "@/test-helpers/theme";
import { NEW_QUIET_LEDGER, recordUse, setAllowance } from "@/utils/emergencyQuiet";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const NOW = new Date(2026, 10, 21, 5);
const { OFF, ONE, TWO, THREE } = EMERGENCY_QUIET_ALLOWANCE;

const option = (allowance: number) =>
  screen.getByRole("radio", {
    name:
      allowance === OFF ? t("common.off") : t("a11y.alarm.quiet.perMonth", { count: allowance }),
  });
const left = () => screen.queryByTestId(EMERGENCY_QUIET_PART.LEFT);
const raised = () => screen.queryByTestId(EMERGENCY_QUIET_PART.RAISED);

const setUp = async (ledger = NEW_QUIET_LEDGER) => {
  useEmergencyQuietStore.setState({ ledger });
  await renderWithTheme(<EmergencyQuietSettings />);
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
};

describe("EmergencyQuietSettings", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it("offers off to three a month, two chosen, and says how many are left", async () => {
    const ledger = recordUse(NEW_QUIET_LEDGER, NOW.getTime()) ?? NEW_QUIET_LEDGER;
    await setUp(ledger);

    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(option(TWO)).toBeSelected();
    expect(left()).toHaveTextContent("1 emergency quiet left this month.");
    expect(raised()).toBeNull();
    expect(
      screen.getByText(t("alarm.quiet.settings.help", { count: EMERGENCY_QUIET_MINUTES }))
    ).toBeVisible();
  });

  it("lowers the allowance at once", async () => {
    const user = await setUp();

    await user.press(option(ONE));

    expect(option(ONE)).toBeSelected();
    expect(left()).toHaveTextContent(t("alarm.quiet.settings.left", { count: ONE }));
    expect(raised()).toBeNull();
  });

  it("raises it from the first of next month, saying so", async () => {
    const user = await setUp();

    await user.press(option(THREE));

    expect(option(THREE)).toBeSelected();
    expect(left()).toHaveTextContent(t("alarm.quiet.settings.left", { count: TWO }));
    expect(raised()).toHaveTextContent(t("alarm.quiet.settings.raised", { date: "1 December" }));
  });

  it("shows no count while it is off", async () => {
    await setUp(setAllowance(NEW_QUIET_LEDGER, OFF, NOW.getTime()));

    expect(option(OFF)).toBeSelected();
    expect(left()).toBeNull();
  });
});

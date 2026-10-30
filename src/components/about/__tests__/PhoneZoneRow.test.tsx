import { AppState } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { PhoneZoneRow } from "@/components/about/PhoneZoneRow";
import { APP_STATE } from "@/constants/AppState";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { renderWithTheme } from "@/test-helpers/theme";
import { phoneZoneReadings } from "@/utils/phoneZone";

jest.mock("@/utils/phoneZone", () => ({ phoneZoneReadings: jest.fn() }));

const RIYADH = "Asia/Riyadh";
const DUBAI = "Asia/Dubai";
const readings = jest.mocked(phoneZoneReadings);

const row = () => screen.getByRole("button", { name: new RegExp(DEBUG_COPY.PHONE_ZONE) });
const label = () => row().props.accessibilityLabel as string;

describe("PhoneZoneRow", () => {
  let listeners: ((state: string) => void)[];

  beforeEach(() => {
    listeners = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
    });
    readings.mockReturnValue({ intl: RIYADH, calendar: RIYADH });
  });

  afterEach(() => jest.restoreAllMocks());

  it("shows both sources", async () => {
    await renderWithTheme(<PhoneZoneRow />);

    expect(label()).toContain(`Intl ${RIYADH}`);
    expect(label()).toContain(`Calendar ${RIYADH}`);
  });

  it("names a source that gives no zone", async () => {
    readings.mockReturnValue({ intl: RIYADH, calendar: null });
    await renderWithTheme(<PhoneZoneRow />);

    expect(label()).toContain(`Calendar ${DEBUG_COPY.NO_ZONE}`);
  });

  it("reads again on a return to the app", async () => {
    await renderWithTheme(<PhoneZoneRow />);
    readings.mockReturnValue({ intl: DUBAI, calendar: DUBAI });

    await act(() => listeners.forEach((listener) => listener(APP_STATE.ACTIVE)));

    expect(label()).toContain(`Intl ${DUBAI}`);
  });

  it("reads again on a tap", async () => {
    await renderWithTheme(<PhoneZoneRow />);
    readings.mockReturnValue({ intl: DUBAI, calendar: RIYADH });

    await userEvent.press(row());

    expect(label()).toContain(`Intl ${DUBAI}`);
    expect(label()).toContain(`Calendar ${RIYADH}`);
  });
});

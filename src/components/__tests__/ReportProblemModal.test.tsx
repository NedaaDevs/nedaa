import { AccessibilityInfo, Platform } from "react-native";
import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import ReportProblemModal from "@/components/ReportProblemModal";
import { REPORT_PROBLEM_STATUS_ID } from "@/constants/ReportProblem";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { submitFeedback } from "@/services/feedback";
import {
  BOTTOM_SHEET_PART,
  gorhomStops,
  modalProps,
  sheetScrollerOf,
} from "@/test-helpers/bottomSheetMock";
import { layOut } from "@/test-helpers/layout";
import { DYNAMIC_ISLAND_INSETS } from "@/test-helpers/safeAreaInsets";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: jest.fn(),
}));
jest.mock("@/services/feedback", () => ({
  ...jest.requireActual("@/services/feedback"),
  submitFeedback: jest.fn(),
}));

const PLATFORM = Platform.OS;
const t = i18n.t.bind(i18n);
const FAILED = t("settings.shareLogs.submitFailed");
const SENDING = t("settings.shareLogs.sending");
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
// A send that never settles holds the sheet in its sending state.
const pending = () => new Promise<never>(() => {});
const onClose = jest.fn();

const openSheet = () =>
  renderWithTheme(
    <ReportProblemModal
      isOpen
      onClose={onClose}
      emailSubject="Subject"
      getReportText={async () => "Report"}
      getSummaryText={async () => "Summary"}
    />
  );

const send = () =>
  userEvent.press(screen.getByRole("button", { name: t("settings.shareLogs.submitDirect") }));

describe("ReportProblemModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSafeAreaInsets).mockReturnValue(DYNAMIC_ISLAND_INSETS);
    jest.mocked(submitFeedback).mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "error").mockImplementation();
  });
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  it("adds no screen-reader stop of gorhom's own", async () => {
    await openSheet();

    expect(gorhomStops()).toEqual([]);
  });

  // The keyboard lifts the sheet no higher than its top inset.
  it("keeps the sheet the $5 step below the status bar", async () => {
    await openSheet();

    expect(modalProps.mock.lastCall?.[0].topInset).toBe(
      DYNAMIC_ISLAND_INSETS.top + getTokenValue("$5", "space")
    );
  });

  // A body taller than the room under the top inset scrolls to its last row.
  it("scrolls its body, and a tap lands with the keyboard up", async () => {
    await openSheet();

    const lastRow = screen.getByRole("button", { name: t("alarm.report.copyToClipboard") });
    expect(sheetScrollerOf(lastRow)).toHaveProp("keyboardShouldPersistTaps", "handled");
  });

  // No close button: on iOS the backdrop is VoiceOver's only way out.
  it("closes from a backdrop named in the app's language", async () => {
    await openSheet();

    await userEvent.press(screen.getByRole("button", { name: t("a11y.dismiss") }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("draws the handle bar in the secondary text colour", async () => {
    await openSheet();

    expect(screen.getByTestId(BOTTOM_SHEET_PART.HANDLE_BAR)).toHaveStyle({
      backgroundColor: getTokenValue("$lightTypographySecondary", "color"),
    });
  });

  it("says on iOS that the report did not send", async () => {
    Platform.OS = PlatformType.IOS;
    await openSheet();

    await send();

    await waitFor(() => expect(announce).toHaveBeenCalledWith(FAILED));
  });

  // TalkBack speaks a change only on a view that is already attached.
  it("says the failure on Android through a region mounted before it", async () => {
    Platform.OS = PlatformType.ANDROID;
    await openSheet();
    const region = screen.getByTestId(REPORT_PROBLEM_STATUS_ID);
    await layOut(region);

    await send();

    await waitFor(() => expect(region).toHaveProp("accessibilityLabel", FAILED));
    expect(screen.getByTestId(REPORT_PROBLEM_STATUS_ID)).toBe(region);
  });

  it("says on iOS that the report is sending", async () => {
    Platform.OS = PlatformType.IOS;
    jest.mocked(submitFeedback).mockImplementation(pending);
    await openSheet();

    await send();

    await waitFor(() => expect(announce).toHaveBeenCalledWith(SENDING));
  });

  it("says on Android that the report is sending", async () => {
    Platform.OS = PlatformType.ANDROID;
    jest.mocked(submitFeedback).mockImplementation(pending);
    await openSheet();
    const region = screen.getByTestId(REPORT_PROBLEM_STATUS_ID);
    await layOut(region);

    await send();

    await waitFor(() => expect(region).toHaveProp("accessibilityLabel", SENDING));
  });
});

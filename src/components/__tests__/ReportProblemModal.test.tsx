import { AccessibilityInfo, Platform } from "react-native";
import { screen, userEvent, waitFor } from "@testing-library/react-native";

import ReportProblemModal from "@/components/ReportProblemModal";
import { REPORT_PROBLEM_STATUS_ID } from "@/constants/ReportProblem";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { submitFeedback } from "@/services/feedback";
import { BOTTOM_SHEET_PART } from "@/test-helpers/bottomSheetMock";
import { layOut } from "@/test-helpers/layout";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
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

const openSheet = () =>
  renderWithTheme(
    <ReportProblemModal
      isOpen
      onClose={jest.fn()}
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
    jest.mocked(submitFeedback).mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "error").mockImplementation();
  });
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  // gorhom groups its content into one "Bottom Sheet" element unless told not to.
  it("lets a screen reader reach each part of the sheet", async () => {
    await openSheet();

    const content = screen.getByTestId(BOTTOM_SHEET_PART.CONTENT);
    expect(content.props.accessible).toBeFalsy();
    expect(content.props.accessibilityLabel).toBeUndefined();
    expect(content.props.accessibilityRole).toBeUndefined();
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

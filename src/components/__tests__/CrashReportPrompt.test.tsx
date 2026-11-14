import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import CrashReportPrompt from "@/components/CrashReportPrompt";
import { CRASH_REPORT_STATUS_ID } from "@/constants/Feedback";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { buildLogAttachment, submitFeedback, type FeedbackReceipt } from "@/services/feedback";
import { gorhomStops, modalProps, sheetScrollerOf } from "@/test-helpers/bottomSheetMock";
import { layOut } from "@/test-helpers/layout";
import { resetOffline, setOffline } from "@/test-helpers/offlineMock";
import { later } from "@/test-helpers/promises";
import { DYNAMIC_ISLAND_INSETS } from "@/test-helpers/safeAreaInsets";
import { renderWithTheme } from "@/test-helpers/theme";
import { Attachment, Tier, type OutgoingAttachment } from "@/types/feedback";
import { clearPendingReport } from "@/utils/crashHandler";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: jest.fn(),
}));
jest.mock("@/hooks/useIsOffline", () => jest.requireActual("@/test-helpers/offlineMock"));
jest.mock("@/services/feedback", () => ({
  ...jest.requireActual("@/services/feedback"),
  submitFeedback: jest.fn(),
  buildLogAttachment: jest.fn(),
}));
// A report from the last launch that is still worth sending.
jest.mock("@/utils/crashHandler", () => ({
  readPendingReport: () => ({}),
  isPendingReportActionable: () => true,
  clearPendingReport: jest.fn(),
}));

const LOG: OutgoingAttachment = {
  kind: Attachment.LOGS,
  mime: "text/plain",
  bytes: 4,
  body: "logs",
};
const RECEIPT: FeedbackReceipt = { id: "report-1", tier: Tier.BASIC };
const PLATFORM = Platform.OS;
const t = i18n.t.bind(i18n);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);

const pressButton = (key: string) => userEvent.press(screen.getByRole("button", { name: t(key) }));

describe("CrashReportPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOffline();
    jest.mocked(useSafeAreaInsets).mockReturnValue(DYNAMIC_ISLAND_INSETS);
    jest.mocked(buildLogAttachment).mockResolvedValue(LOG);
  });

  it("adds no screen-reader stop of gorhom's own", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    expect(gorhomStops()).toEqual([]);
  });

  // The keyboard lifts the sheet no higher than its top inset.
  it("keeps the sheet the $5 step below the status bar", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    expect(modalProps.mock.lastCall?.[0].topInset).toBe(
      DYNAMIC_ISLAND_INSETS.top + getTokenValue("$5", "space")
    );
  });

  // A body taller than the room under the top inset scrolls to its last row.
  it("scrolls its body, and a tap lands with the keyboard up", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    const send = screen.getByRole("button", { name: t("crashPrompt.send") });
    expect(sheetScrollerOf(send)).toHaveProp("keyboardShouldPersistTaps", "handled");
  });

  it("closes from a backdrop named in the app's language", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    await userEvent.press(screen.getByRole("button", { name: t("a11y.dismiss") }));

    expect(clearPendingReport).toHaveBeenCalledTimes(1);
  });

  // Jest runs as iOS, which has no live regions.
  describe("out loud", () => {
    it("says the report arrived", async () => {
      jest.mocked(submitFeedback).mockResolvedValue(RECEIPT);
      await renderWithTheme(<CrashReportPrompt />);

      await pressButton("crashPrompt.send");
      await screen.findByText(t("feedback.success.title"));

      expect(announce).toHaveBeenCalledWith(t("feedback.success.body"));
    });

    it("says the send failed, and says it again when a retry fails", async () => {
      const retry = later<FeedbackReceipt>();
      jest
        .mocked(submitFeedback)
        .mockRejectedValueOnce(new Error())
        .mockReturnValueOnce(retry.promise);
      await renderWithTheme(<CrashReportPrompt />);

      await pressButton("crashPrompt.send");
      await screen.findByText(t("feedback.error"));
      await pressButton("feedback.retry");
      // A retry in flight takes the error off the screen.
      expect(screen.queryByText(t("feedback.error"))).toBeNull();
      await act(async () => retry.fail(new Error()));

      const said = announce.mock.calls.filter(([text]) => text === t("feedback.error"));
      expect(said).toHaveLength(2);
    });

    it("says the phone is offline", async () => {
      await setOffline(true);
      await renderWithTheme(<CrashReportPrompt />);

      expect(announce).toHaveBeenCalledWith(t("feedback.offline"));
    });
  });

  // TalkBack says a change only on a region that is already drawn.
  describe("on Android", () => {
    beforeEach(() => {
      Platform.OS = PlatformType.ANDROID;
    });
    afterEach(() => {
      Platform.OS = PLATFORM;
    });

    it("says the report arrived", async () => {
      jest.mocked(submitFeedback).mockResolvedValue(RECEIPT);
      await renderWithTheme(<CrashReportPrompt />);

      await pressButton("crashPrompt.send");
      const region = await screen.findByTestId(CRASH_REPORT_STATUS_ID.SENT);
      await layOut(region);

      expect(region).toHaveProp("accessibilityLabel", t("feedback.success.body"));
    });

    it("says the send failed through a region drawn before it", async () => {
      jest.mocked(submitFeedback).mockRejectedValue(new Error());
      await renderWithTheme(<CrashReportPrompt />);
      const region = screen.getByTestId(CRASH_REPORT_STATUS_ID.FAILED);
      await layOut(region);

      await pressButton("crashPrompt.send");

      await waitFor(() => expect(region).toHaveProp("accessibilityLabel", t("feedback.error")));
      expect(screen.getByTestId(CRASH_REPORT_STATUS_ID.FAILED)).toBe(region);
    });

    it("says the phone is offline when the prompt opens offline", async () => {
      await setOffline(true);
      await renderWithTheme(<CrashReportPrompt />);
      const region = screen.getByTestId(CRASH_REPORT_STATUS_ID.OFFLINE);
      await layOut(region);

      expect(region).toHaveProp("accessibilityLabel", t("feedback.offline"));
    });

    it("says the phone went offline through a region drawn before it", async () => {
      await renderWithTheme(<CrashReportPrompt />);
      const region = screen.getByTestId(CRASH_REPORT_STATUS_ID.OFFLINE);
      await layOut(region);
      expect(region).toHaveProp("accessibilityLabel", "");

      await setOffline(true);

      expect(region).toHaveProp("accessibilityLabel", t("feedback.offline"));
      expect(screen.getByTestId(CRASH_REPORT_STATUS_ID.OFFLINE)).toBe(region);
    });
  });
});

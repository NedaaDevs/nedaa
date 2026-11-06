// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import FeedbackScreen from "@/app/settings/feedback";
import { AccessibilityInfo } from "react-native";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import {
  buildLogAttachment,
  pickImageAttachment,
  submitFeedback,
  type FeedbackReceipt,
} from "@/services/feedback";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";
import { Attachment, Report, Tier, type OutgoingAttachment } from "@/types/feedback";
import { formatFileSizeLocale } from "@/utils/number";

let mockOffline = false;

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => mockOffline }));
jest.mock("@/services/feedback", () => ({
  ...jest.requireActual("@/services/feedback"),
  submitFeedback: jest.fn(),
  buildLogAttachment: jest.fn(),
  pickImageAttachment: jest.fn(),
}));

const LOG: OutgoingAttachment = {
  kind: Attachment.LOGS,
  mime: "text/plain",
  bytes: 4,
  body: "logs",
};
const RECEIPT: FeedbackReceipt = { id: "report-1", tier: Tier.BASIC };

const t = i18n.t.bind(i18n);

const renderFeedback = () =>
  renderRouter(
    { [BACK_DESTINATION.SETTINGS_FEEDBACK.route]: () => <FeedbackScreen /> },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_FEEDBACK.href,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const sendButton = (key: string) => screen.getByRole("button", { name: t(key) });

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  useAppStore.setState({ locale: AppLocale.EN });
  jest.mocked(buildLogAttachment).mockResolvedValue(LOG);
});

describe("Feedback", () => {
  it("sends a bug report with its logs and shows the reference", async () => {
    jest.mocked(submitFeedback).mockResolvedValue(RECEIPT);
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t("feedback.type.bug")));
    await user.press(sendButton("feedback.send"));

    expect(
      await screen.findByText(t("feedback.success.reference", { id: RECEIPT.id }))
    ).toBeTruthy();
    expect(submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: Report.BUG, attachments: [LOG] }),
      expect.any(Function)
    );
  });

  it("says the send failed, and its retry sends under the same key", async () => {
    jest.mocked(submitFeedback).mockRejectedValueOnce(new Error()).mockResolvedValue(RECEIPT);
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t("feedback.type.feature")));
    await user.press(sendButton("feedback.send"));
    expect(await screen.findByText(t("feedback.error"))).toBeTruthy();

    await user.press(sendButton("feedback.retry"));

    expect(await screen.findByText(t("feedback.success.title"))).toBeTruthy();
    const [first, retry] = jest.mocked(submitFeedback).mock.calls.map(([input]) => input);
    expect(first.clientKey).toEqual(expect.any(String));
    expect(retry.clientKey).toBe(first.clientKey);
  });

  // Jest runs as iOS, which has no live regions.
  describe("out loud", () => {
    const announce = AccessibilityInfo.announceForAccessibility;

    it("says the report arrived", async () => {
      jest.mocked(submitFeedback).mockResolvedValue(RECEIPT);
      await renderFeedback();
      const user = userEvent.setup();

      await user.press(screen.getByLabelText(t("feedback.type.feature")));
      await user.press(sendButton("feedback.send"));
      await screen.findByText(t("feedback.success.title"));

      expect(announce).toHaveBeenCalledWith(t("feedback.success.body"));
    });

    it("says the send failed, and says it again when a retry fails", async () => {
      jest.mocked(submitFeedback).mockRejectedValue(new Error());
      await renderFeedback();
      const user = userEvent.setup();

      await user.press(screen.getByLabelText(t("feedback.type.feature")));
      await user.press(sendButton("feedback.send"));
      await screen.findByText(t("feedback.error"));
      await user.press(sendButton("feedback.retry"));
      await screen.findByText(t("feedback.error"));

      const said = jest
        .mocked(announce)
        .mock.calls.filter(([text]) => text === t("feedback.error"));
      expect(said).toHaveLength(2);
    });

    it("says the phone is offline", async () => {
      mockOffline = true;
      await renderFeedback();

      expect(announce).toHaveBeenCalledWith(t("feedback.offline"));
    });

    it("says why an image was refused", async () => {
      jest.mocked(pickImageAttachment).mockResolvedValue({ ok: false, reason: "tooLarge" });
      await renderFeedback();
      const user = userEvent.setup();

      await user.press(sendButton("feedback.details.show"));
      await user.press(sendButton("feedback.image.add"));

      expect(await screen.findByText(t("feedback.image.tooLarge"))).toBeTruthy();
      expect(announce).toHaveBeenCalledWith(t("feedback.image.tooLarge"));
    });
  });

  it("names the log preview for what a press does, and says if it is open", async () => {
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t("feedback.type.bug")));
    const preview = await screen.findByRole("button", { name: t("feedback.logs.preview") });
    expect(preview).toBeCollapsed();

    await user.press(preview);

    expect(sendButton("feedback.logs.hidePreview")).toBeExpanded();
  });

  it("names the send button for the send under way", async () => {
    jest.mocked(submitFeedback).mockReturnValue(new Promise(() => {}));
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t("feedback.type.feature")));
    await user.press(sendButton("feedback.send"));

    expect(await screen.findByRole("button", { name: t("feedback.sending") })).toBeDisabled();
  });

  it("writes the size of the logs in the reader's units", async () => {
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText(t("feedback.type.bug")));

    expect(await screen.findByText(formatFileSizeLocale(LOG.bytes, t))).toBeTruthy();
  });

  it.each(["feedback.typeLabel", "feedback.area.label"])("groups the %s choices", async (label) => {
    await renderFeedback();

    await userEvent.setup().press(sendButton("feedback.details.show"));

    // The drawn title carries the same words, so the group is the labelled one.
    expect(screen.getByLabelText(t(label))).toHaveProp("accessibilityRole", "radiogroup");
  });

  it("says that a second press on the chosen area clears it", async () => {
    await renderFeedback();
    const user = userEvent.setup();

    await user.press(sendButton("feedback.details.show"));
    const area = screen.getByRole("radio", { name: t("feedback.area.quran") });
    expect(area).not.toHaveProp("accessibilityHint");

    await user.press(area);
    expect(screen.getByRole("radio", { name: t("feedback.area.quran") })).toHaveProp(
      "accessibilityHint",
      t("a11y.feedback.clearAreaHint")
    );
  });
});

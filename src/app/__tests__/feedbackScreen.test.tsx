// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import FeedbackScreen from "@/app/settings/feedback";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { buildLogAttachment, submitFeedback, type FeedbackReceipt } from "@/services/feedback";
import { useAppStore } from "@/stores/app";
import { ThemeProvider } from "@/test-helpers/theme";
import { Attachment, Report, Tier, type OutgoingAttachment } from "@/types/feedback";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => false }));
jest.mock("@/services/feedback", () => ({
  ...jest.requireActual("@/services/feedback"),
  submitFeedback: jest.fn(),
  buildLogAttachment: jest.fn(),
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
    expect(retry.clientKey).toBe(first.clientKey);
  });
});

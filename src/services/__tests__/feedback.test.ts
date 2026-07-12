const mockCreate = jest.fn();
const mockUpload = jest.fn();
const mockSubmit = jest.fn();

// Lazy wrappers so the bindings resolve at call-time (feedback.ts imports these at module load,
// before the mock fns above are assigned via import hoisting).
jest.mock("@/api/feedback.api", () => ({
  createFeedbackDraft: (...a: unknown[]) => mockCreate(...a),
  uploadFeedbackAttachment: (...a: unknown[]) => mockUpload(...a),
  submitFeedbackReport: (...a: unknown[]) => mockSubmit(...a),
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "2.9.4",
  nativeBuildVersion: "100",
}));
jest.mock("expo-device", () => ({ modelName: "iPhone 15" }));
jest.mock("react-native", () => ({ Platform: { OS: "ios", Version: "17.0" } }));
jest.mock("@/localization/i18n", () => ({ language: "en" }));
jest.mock("@/utils/appLogger", () => ({
  getInstallSource: () => "App Store",
  AppLogger: { buildReport: async () => "LOG BUNDLE TEXT" },
}));

// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import {
  submitFeedback,
  buildAppMeta,
  buildLogAttachment,
  generateClientKey,
} from "@/services/feedback";
// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import { Attachment, Report } from "@/types/feedback";

const draft = (uploads: unknown[] = []) => ({
  id: "r1",
  submitToken: "tok",
  tier: "basic",
  uploads,
});

describe("submitFeedback", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpload.mockReset();
    mockSubmit.mockReset();
    mockUpload.mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue(undefined);
  });

  it("creates, uploads each attachment to its slot, then submits", async () => {
    const slot = {
      attachmentId: "a1",
      url: "https://r2/put",
      headers: { "Content-Type": "text/plain" },
    };
    mockCreate.mockResolvedValue(draft([slot]));
    const attachment = { kind: Attachment.LOGS, mime: "text/plain", bytes: 10, body: "x" };

    const receipt = await submitFeedback({
      type: Report.BUG,
      message: "  hi  ",
      contact: "  a@b.com  ",
      area: "alarms",
      attachments: [attachment],
    });

    expect(receipt).toEqual({ id: "r1", tier: "basic" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bug",
        message: "hi",
        area: "alarms",
        contact: { value: "a@b.com" },
        attachments: [{ kind: "logs", mime: "text/plain", bytes: 10 }],
        app: expect.objectContaining({
          version: "2.9.4",
          build: "100",
          platform: "ios",
          osVersion: "17.0",
          device: "iPhone 15",
          source: "App Store",
          locale: "en",
        }),
        clientKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        ),
      })
    );
    expect(mockUpload).toHaveBeenCalledWith(slot, attachment);
    expect(mockSubmit).toHaveBeenCalledWith("r1", "tok");
  });

  it("skips uploads and sends no attachments field when there are none", async () => {
    mockCreate.mockResolvedValue(draft([]));
    await submitFeedback({ type: Report.FEATURE, message: "an idea" });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreate.mock.calls[0][0].attachments).toBeUndefined();
  });

  it("normalizes a whitespace-only message and absent contact to undefined", async () => {
    mockCreate.mockResolvedValue(draft([]));
    await submitFeedback({ type: Report.OTHER, message: "   " });

    const body = mockCreate.mock.calls[0][0];
    expect(body.message).toBeUndefined();
    expect(body.contact).toBeUndefined();
  });

  it("propagates a create failure without uploading or submitting", async () => {
    mockCreate.mockRejectedValue(new Error("503"));
    await expect(submitFeedback({ type: Report.CRASH })).rejects.toThrow("503");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("buildAppMeta reads version/build/source from the app", () => {
    expect(buildAppMeta()).toEqual({
      version: "2.9.4",
      build: "100",
      platform: "ios",
      osVersion: "17.0",
      device: "iPhone 15",
      source: "App Store",
      locale: "en",
    });
  });

  it("buildLogAttachment returns a text/plain logs attachment sized in UTF-8 bytes", async () => {
    const a = await buildLogAttachment();
    expect(a.kind).toBe("logs");
    expect(a.mime).toBe("text/plain");
    expect(a.body).toBe("LOG BUNDLE TEXT");
    expect(a.bytes).toBe(15);
  });

  it("generateClientKey produces a v4 UUID", () => {
    expect(generateClientKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

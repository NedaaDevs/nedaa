import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { AppLogger, getInstallSource } from "@/utils/appLogger";
import {
  createFeedbackDraft,
  submitFeedbackReport,
  uploadFeedbackAttachment,
} from "@/api/feedback.api";
import {
  Attachment,
  type AppMeta,
  type CreateReportBody,
  type FeedbackTier,
  type OutgoingAttachment,
  type ReportType,
} from "@/types/feedback";

interface LogReportOptions {
  domains?: string[];
  category?: string;
  description?: string;
}

export interface SubmitFeedbackInput {
  type: ReportType;
  message?: string;
  area?: string;
  contact?: string;
  attachments?: OutgoingAttachment[];
}

export interface FeedbackReceipt {
  id: string;
  tier: FeedbackTier;
}

// UTF-8 byte length without TextEncoder (not guaranteed in Hermes). Surrogate pairs count as 4.
const utf8ByteLength = (s: string): number => {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
};

// v4 UUID for the create idempotency key. Not a security token — Math.random entropy is fine.
export const generateClientKey = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export const buildAppMeta = (): AppMeta => ({
  version: Application.nativeApplicationVersion ?? "unknown",
  build: Application.nativeBuildVersion ?? "unknown",
  platform: Platform.OS === PlatformType.IOS ? PlatformType.IOS : PlatformType.ANDROID,
  osVersion: String(Platform.Version),
  device: Device.modelName ?? undefined,
  source: getInstallSource(),
  locale: i18n.language,
});

// Build a text/plain log-bundle attachment from the on-device logger.
export const buildLogAttachment = async (
  opts: LogReportOptions = {}
): Promise<OutgoingAttachment> => {
  const text = await AppLogger.buildReport(opts);
  return { kind: Attachment.LOGS, mime: "text/plain", bytes: utf8ByteLength(text), body: text };
};

// Create the draft, upload each attachment to its presigned slot, then submit. Attachments map
// to upload slots by index — the backend presigns them in the order they were sent.
export const submitFeedback = async (input: SubmitFeedbackInput): Promise<FeedbackReceipt> => {
  const attachments = input.attachments ?? [];
  const message = input.message?.trim();
  const contact = input.contact?.trim();

  const body: CreateReportBody = {
    type: input.type,
    message: message || undefined,
    area: input.area,
    contact: contact ? { value: contact } : undefined,
    app: buildAppMeta(),
    attachments: attachments.length
      ? attachments.map(({ kind, mime, bytes }) => ({ kind, mime, bytes }))
      : undefined,
    clientKey: generateClientKey(),
  };

  const draft = await createFeedbackDraft(body);

  await Promise.all(
    draft.uploads.map((slot, index) => uploadFeedbackAttachment(slot, attachments[index]))
  );

  await submitFeedbackReport(draft.id, draft.submitToken);
  return { id: draft.id, tier: draft.tier };
};

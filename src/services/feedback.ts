import * as Application from "expo-application";
import * as Device from "expo-device";
import { getDocumentAsync } from "expo-document-picker";
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
  // Reused across retries of the same report so the backend dedupes instead of duplicating.
  clientKey?: string;
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

// Image is the only user-media kind allowed at the basic tier (video requires attestation).
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/heic", "image/webp"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ImagePickResult =
  | { ok: true; attachment: OutgoingAttachment }
  | { ok: false; reason: "canceled" | "tooLarge" | "unsupported" };

// Pick a single image from the device and shape it into an OutgoingAttachment (streamed on upload).
export const pickImageAttachment = async (): Promise<ImagePickResult> => {
  const res = await getDocumentAsync({
    type: IMAGE_MIMES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || res.assets.length === 0) return { ok: false, reason: "canceled" };

  const asset = res.assets[0];
  const mime = asset.mimeType ?? "";
  if (!IMAGE_MIMES.includes(mime)) return { ok: false, reason: "unsupported" };

  const bytes = asset.size ?? 0;
  if (bytes > IMAGE_MAX_BYTES) return { ok: false, reason: "tooLarge" };

  return {
    ok: true,
    attachment: { kind: Attachment.IMAGE, mime, bytes, body: { uri: asset.uri } },
  };
};

// One operation to the caller: onProgress reports a single 0→1 track across create/upload/submit.
// Uploads map to slots by index (backend presigns in the order sent).
export const submitFeedback = async (
  input: SubmitFeedbackInput,
  onProgress?: (fraction: number) => void
): Promise<FeedbackReceipt> => {
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
    clientKey: input.clientKey ?? generateClientKey(),
  };

  onProgress?.(0.05);
  const draft = await createFeedbackDraft(body);
  onProgress?.(0.15);

  const total = draft.uploads.length;
  let done = 0;
  await Promise.all(
    draft.uploads.map((slot, index) =>
      uploadFeedbackAttachment(slot, attachments[index]).then(() => {
        done += 1;
        onProgress?.(0.15 + 0.75 * (done / Math.max(total, 1)));
      })
    )
  );

  onProgress?.(0.9);
  await submitFeedbackReport(draft.id, draft.submitToken);
  onProgress?.(1);
  return { id: draft.id, tier: draft.tier };
};

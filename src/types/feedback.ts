import type { PlatformType } from "@/enums/app";

export const Report = {
  CRASH: "crash",
  BUG: "bug",
  FEATURE: "feature",
  OTHER: "other",
} as const;
export type ReportType = (typeof Report)[keyof typeof Report];

export const Attachment = {
  LOGS: "logs",
  IMAGE: "image",
  VIDEO: "video",
} as const;
export type AttachmentKind = (typeof Attachment)[keyof typeof Attachment];

export const Tier = {
  BASIC: "basic",
  ATTESTED: "attested",
} as const;
export type FeedbackTier = (typeof Tier)[keyof typeof Tier];

export interface AppMeta {
  version: string;
  build: string;
  platform: PlatformType;
  osVersion: string;
  device?: string;
  source?: string;
  locale?: string;
}

// Attachment descriptor sent in the create body (metadata only — bytes is the size).
export interface AttachmentInput {
  kind: AttachmentKind;
  mime: string;
  bytes: number;
}

// Attachment carrying the actual payload to PUT to R2, plus its create-body metadata.
export interface OutgoingAttachment extends AttachmentInput {
  body: string | Uint8Array | Blob;
}

export interface CreateReportBody {
  type: ReportType;
  message?: string;
  area?: string;
  contact?: { value: string };
  app: AppMeta;
  attachments?: AttachmentInput[];
  clientKey: string;
}

export interface UploadSlot {
  attachmentId: string;
  url: string;
  headers?: Record<string, string>;
}

export interface CreateReportResponse {
  id: string;
  submitToken: string;
  tier: FeedbackTier;
  uploads: UploadSlot[];
}

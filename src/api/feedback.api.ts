import { File } from "expo-file-system";

import type {
  CreateReportBody,
  CreateReportResponse,
  OutgoingAttachment,
  UploadSlot,
} from "@/types/feedback";

// The base already includes the /v3 prefix (see .env EXPO_PUBLIC_API_URL).
const API_URL = process.env.EXPO_PUBLIC_API_URL;

type FeedbackStep = "create" | "upload" | "submit";

export class FeedbackApiError extends Error {
  constructor(
    readonly step: FeedbackStep,
    readonly status: number,
    readonly detail?: string
  ) {
    super(`feedback ${step} failed (${status})`);
    this.name = "FeedbackApiError";
  }
}

const requireBase = (): string => {
  if (!API_URL) throw new FeedbackApiError("create", 0, "EXPO_PUBLIC_API_URL is not configured");
  return API_URL;
};

const readDetail = async (res: globalThis.Response): Promise<string | undefined> => {
  try {
    return (await res.text()) || undefined;
  } catch {
    return undefined;
  }
};

export const createFeedbackDraft = async (
  body: CreateReportBody
): Promise<CreateReportResponse> => {
  const res = await fetch(`${requireBase()}/feedback-reports/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new FeedbackApiError("create", res.status, await readDetail(res));
  return (await res.json()) as CreateReportResponse;
};

// PUT the attachment straight to R2. The presigned URL is signed with the content type, so the
// PUT must echo the returned headers exactly (Content-Type) or the signature fails. Inline text
// (logs) goes through fetch; a local file (picked media) is streamed by uploadAsync so a large
// file never sits in JS memory.
export const uploadFeedbackAttachment = async (
  slot: UploadSlot,
  attachment: OutgoingAttachment
): Promise<void> => {
  const headers = slot.headers ?? { "Content-Type": attachment.mime };

  if (typeof attachment.body === "string") {
    const res = await fetch(slot.url, { method: "PUT", headers, body: attachment.body });
    if (!res.ok) throw new FeedbackApiError("upload", res.status, await readDetail(res));
    return;
  }

  const result = await new File(attachment.body.uri).upload(slot.url, {
    httpMethod: "PUT",
    headers,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new FeedbackApiError("upload", result.status);
  }
};

export const submitFeedbackReport = async (id: string, submitToken: string): Promise<void> => {
  const res = await fetch(`${requireBase()}/feedback-reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ submitToken }),
  });
  if (!res.ok) throw new FeedbackApiError("submit", res.status, await readDetail(res));
};

import { z } from "zod";

export const privacySeedSchema = z.object({
  highlight: z.enum(["no-tracking", "no-analytics", "on-device-only"]),
});

export type PrivacySeed = z.infer<typeof privacySeedSchema>;

const raw = {
  default: { highlight: "no-tracking" },
} as const;

export const privacyPresets: Record<string, PrivacySeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, privacySeedSchema.parse(v)])
);

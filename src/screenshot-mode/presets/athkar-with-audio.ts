import { z } from "zod";

export const athkarWithAudioSeedSchema = z.object({
  reciter: z.string(),
  trackIndex: z.number().int().nonnegative(),
  pausedAtSeconds: z.number().nonnegative(),
  totalSeconds: z.number().positive(),
});

export type AthkarWithAudioSeed = z.infer<typeof athkarWithAudioSeedSchema>;

const raw = {
  "track-2-at-1m14s": {
    reciter: "Mishary Alafasy",
    trackIndex: 2,
    pausedAtSeconds: 74,
    totalSeconds: 240,
  },
} as const;

export const athkarWithAudioPresets: Record<string, AthkarWithAudioSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, athkarWithAudioSeedSchema.parse(v)])
);

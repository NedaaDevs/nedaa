import { z } from "zod";

// Positions the Umrah journey timeline at a mid-journey point so the screenshot
// looks "in use". `stageIndex` is the current stage (0-based over the 4 stages:
// ihram, tawaf, sai, tahallul); the store derives completed stages as every
// stage before it, keeping the completed set consistent with the position.
export const umrahSeedSchema = z.object({
  stageIndex: z.number().int().min(0).max(3),
  stepIndex: z.number().int().nonnegative(),
});

export type UmrahSeed = z.infer<typeof umrahSeedSchema>;

const raw = {
  // On Sa'i, with Ihram and Tawaf already completed (2 of 4 stages done).
  "sai-2-of-4": { stageIndex: 2, stepIndex: 1 },
} as const;

export const umrahPresets: Record<string, UmrahSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, umrahSeedSchema.parse(v)])
);

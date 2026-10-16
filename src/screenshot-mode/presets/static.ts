import { z } from "zod";

// A settings screen reads no seed; it shows the preferences as saved. This
// preset exists only so the router's getPreset() guard passes.
export const staticSeedSchema = z.object({}).strict();

export type StaticSeed = z.infer<typeof staticSeedSchema>;

export const staticPresets: Record<string, StaticSeed> = {
  default: staticSeedSchema.parse({}),
};

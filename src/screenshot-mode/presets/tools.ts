import { z } from "zod";

// The Tools menu is static content (Umrah / Hijri / Compass cards); the screen
// reads no seed. This preset exists only so the router's getPreset() guard
// returns non-null and navigation proceeds.
export const toolsSeedSchema = z.object({
  focus: z.enum(["overview"]),
});

export type ToolsSeed = z.infer<typeof toolsSeedSchema>;

const raw = {
  default: { focus: "overview" },
} as const;

export const toolsPresets: Record<string, ToolsSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, toolsSeedSchema.parse(v)])
);

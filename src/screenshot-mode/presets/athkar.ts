import { z } from "zod";

export const athkarSeedSchema = z.object({
  period: z.enum(["morning", "evening"]),
  progress: z.object({ completed: z.number().int(), total: z.number().int() }),
});

export type AthkarSeed = z.infer<typeof athkarSeedSchema>;

const raw = {
  "morning-3-of-10": {
    period: "morning",
    progress: { completed: 3, total: 10 },
  },
} as const;

export const athkarPresets: Record<string, AthkarSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, athkarSeedSchema.parse(v)])
);

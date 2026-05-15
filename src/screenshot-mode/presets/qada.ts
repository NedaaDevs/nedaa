import { z } from "zod";

export const qadaSeedSchema = z.object({
  fajr: z.number().int().nonnegative(),
  dhuhr: z.number().int().nonnegative(),
  asr: z.number().int().nonnegative(),
  maghrib: z.number().int().nonnegative(),
  isha: z.number().int().nonnegative(),
});

export type QadaSeed = z.infer<typeof qadaSeedSchema>;

const raw = {
  "missed-3-2-4-1-2": {
    fajr: 3,
    dhuhr: 2,
    asr: 4,
    maghrib: 1,
    isha: 2,
  },
} as const;

export const qadaPresets: Record<string, QadaSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, qadaSeedSchema.parse(v)])
);

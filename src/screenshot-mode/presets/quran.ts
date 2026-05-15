import { z } from "zod";

export const quranSeedSchema = z.object({
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1),
  page: z.number().int().min(1).max(604),
});

export type QuranSeed = z.infer<typeof quranSeedSchema>;

const raw = {
  "al-fatiha-page-1": { surah: 1, ayah: 1, page: 1 },
} as const;

export const quranPresets: Record<string, QuranSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, quranSeedSchema.parse(v)])
);

import { z } from "zod";

export const prayerTimesSeedSchema = z.object({
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    city: z.string(),
  }),
  frozenNow: z.number(),
  nextPrayer: z.enum(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]),
  qadaCount: z.number().int().nonnegative(),
});

export type PrayerTimesSeed = z.infer<typeof prayerTimesSeedSchema>;

const raw = {
  "makkah-dhuhr-2h14m": {
    location: { lat: 21.4225, lng: 39.8262, city: "Makkah" },
    frozenNow: Date.parse("2026-05-13T10:46:00+03:00"),
    nextPrayer: "Dhuhr",
    qadaCount: 0,
  },
} as const;

export const prayerTimesPresets: Record<string, PrayerTimesSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, prayerTimesSeedSchema.parse(v)])
);

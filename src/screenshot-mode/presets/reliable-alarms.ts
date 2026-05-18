import { z } from "zod";

export const reliableAlarmsSeedSchema = z.object({
  ringingPrayer: z.enum(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]),
  ringingAt: z.number(),
  city: z.string(),
});

export type ReliableAlarmsSeed = z.infer<typeof reliableAlarmsSeedSchema>;

const raw = {
  "fajr-madinah-ringing": {
    ringingPrayer: "Fajr",
    ringingAt: Date.parse("2026-05-13T04:23:00+03:00"),
    city: "Makkah",
  },
} as const;

export const reliableAlarmsPresets: Record<string, ReliableAlarmsSeed> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, reliableAlarmsSeedSchema.parse(v)])
);

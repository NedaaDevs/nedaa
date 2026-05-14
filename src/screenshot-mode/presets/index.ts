import type { ScreenshotScreenKey } from "@/stores/screenshotStore";
import { prayerTimesPresets, type PrayerTimesSeed } from "./prayer-times";

export type PresetMap = {
  "prayer-times": PrayerTimesSeed;
  "reliable-alarms": unknown;
  athkar: unknown;
  qibla: unknown;
  privacy: unknown;
  qada: unknown;
  quran: unknown;
  "athkar-with-audio": unknown;
};

export const presets: { [K in ScreenshotScreenKey]: Record<string, PresetMap[K]> } = {
  "prayer-times": prayerTimesPresets,
  "reliable-alarms": {},
  athkar: {},
  qibla: {},
  privacy: {},
  qada: {},
  quran: {},
  "athkar-with-audio": {},
};

export function getPreset<K extends ScreenshotScreenKey>(
  screen: K,
  seed: string
): PresetMap[K] | null {
  const entry = presets[screen][seed];
  return entry === undefined ? null : (entry as PresetMap[K]);
}

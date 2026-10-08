import type { ScreenshotScreenKey, StaticScreenshotScreenKey } from "@/constants/Screenshot";
import { prayerTimesPresets, type PrayerTimesSeed } from "./prayer-times";
import { reliableAlarmsPresets, type ReliableAlarmsSeed } from "./reliable-alarms";
import { athkarPresets, type AthkarSeed } from "./athkar";
import { qiblaPresets, type QiblaSeed } from "./qibla";
import { qadaPresets, type QadaSeed } from "./qada";
import { quranPresets, type QuranSeed } from "./quran";
import { athkarWithAudioPresets, type AthkarWithAudioSeed } from "./athkar-with-audio";
import { toolsPresets, type ToolsSeed } from "./tools";
import { umrahPresets, type UmrahSeed } from "./umrah";
import { staticPresets, type StaticSeed } from "./static";

export type PresetMap = {
  "prayer-times": PrayerTimesSeed;
  "reliable-alarms": ReliableAlarmsSeed;
  athkar: AthkarSeed;
  qibla: QiblaSeed;
  qada: QadaSeed;
  quran: QuranSeed;
  "athkar-with-audio": AthkarWithAudioSeed;
  tools: ToolsSeed;
  umrah: UmrahSeed;
} & { [K in StaticScreenshotScreenKey]: StaticSeed };

export const presets: { [K in ScreenshotScreenKey]: Record<string, PresetMap[K]> } = {
  "prayer-times": prayerTimesPresets,
  "reliable-alarms": reliableAlarmsPresets,
  athkar: athkarPresets,
  qibla: qiblaPresets,
  qada: qadaPresets,
  quran: quranPresets,
  "athkar-with-audio": athkarWithAudioPresets,
  tools: toolsPresets,
  umrah: umrahPresets,
  settings: staticPresets,
  "settings-appearance": staticPresets,
  "settings-language": staticPresets,
  "settings-text-size": staticPresets,
  "settings-hijri": staticPresets,
  "settings-privacy": staticPresets,
};

export function getPreset<K extends ScreenshotScreenKey>(
  screen: K,
  seed: string
): PresetMap[K] | null {
  const entry = presets[screen][seed];
  return entry === undefined ? null : (entry as PresetMap[K]);
}

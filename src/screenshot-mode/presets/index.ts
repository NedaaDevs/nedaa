import type { ScreenshotScreenKey, StaticScreenshotScreenKey } from "@/constants/Screenshot";
import { prayerTimesPresets, type PrayerTimesSeed } from "@/screenshot-mode/presets/prayer-times";
import {
  reliableAlarmsPresets,
  type ReliableAlarmsSeed,
} from "@/screenshot-mode/presets/reliable-alarms";
import { athkarPresets, type AthkarSeed } from "@/screenshot-mode/presets/athkar";
import { qiblaPresets, type QiblaSeed } from "@/screenshot-mode/presets/qibla";
import { qadaPresets, type QadaSeed } from "@/screenshot-mode/presets/qada";
import { quranPresets, type QuranSeed } from "@/screenshot-mode/presets/quran";
import {
  athkarWithAudioPresets,
  type AthkarWithAudioSeed,
} from "@/screenshot-mode/presets/athkar-with-audio";
import { toolsPresets, type ToolsSeed } from "@/screenshot-mode/presets/tools";
import { umrahPresets, type UmrahSeed } from "@/screenshot-mode/presets/umrah";
import { staticPresets, type StaticSeed } from "@/screenshot-mode/presets/static";

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

import type { ScreenshotScreenKey } from "@/stores/screenshotStore";
import { prayerTimesPresets, type PrayerTimesSeed } from "./prayer-times";
import { reliableAlarmsPresets, type ReliableAlarmsSeed } from "./reliable-alarms";
import { athkarPresets, type AthkarSeed } from "./athkar";
import { qiblaPresets, type QiblaSeed } from "./qibla";
import { privacyPresets, type PrivacySeed } from "./privacy";
import { qadaPresets, type QadaSeed } from "./qada";
import { quranPresets, type QuranSeed } from "./quran";
import { athkarWithAudioPresets, type AthkarWithAudioSeed } from "./athkar-with-audio";
import { toolsPresets, type ToolsSeed } from "./tools";
import { umrahPresets, type UmrahSeed } from "./umrah";

export type PresetMap = {
  "prayer-times": PrayerTimesSeed;
  "reliable-alarms": ReliableAlarmsSeed;
  athkar: AthkarSeed;
  qibla: QiblaSeed;
  privacy: PrivacySeed;
  qada: QadaSeed;
  quran: QuranSeed;
  "athkar-with-audio": AthkarWithAudioSeed;
  tools: ToolsSeed;
  umrah: UmrahSeed;
};

export const presets: { [K in ScreenshotScreenKey]: Record<string, PresetMap[K]> } = {
  "prayer-times": prayerTimesPresets,
  "reliable-alarms": reliableAlarmsPresets,
  athkar: athkarPresets,
  qibla: qiblaPresets,
  privacy: privacyPresets,
  qada: qadaPresets,
  quran: quranPresets,
  "athkar-with-audio": athkarWithAudioPresets,
  tools: toolsPresets,
  umrah: umrahPresets,
};

export function getPreset<K extends ScreenshotScreenKey>(
  screen: K,
  seed: string
): PresetMap[K] | null {
  const entry = presets[screen][seed];
  return entry === undefined ? null : (entry as PresetMap[K]);
}

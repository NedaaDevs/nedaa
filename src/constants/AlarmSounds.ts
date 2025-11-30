// Constants
import { SOUND_ASSETS, PrayerSoundKey } from "@/constants/sounds";

// ==========================================
// ALARM SOUND KEYS
// ==========================================

// Alarm sounds are a subset of prayer sounds (athan variants)
export const ALARM_SOUND_KEYS: PrayerSoundKey[] = [
  "makkahAthan1",
  "medinaAthan",
  "yasserAldosari",
  "athan2",
  "athan3",
  "takbir",
  "tasbih",
  "beep",
];

// ==========================================
// ALARM SOUND CONFIG
// ==========================================

export type AlarmSoundConfig = {
  key: PrayerSoundKey;
  label: string;
  previewSource: number | null;
  notificationSound: string | null;
};

// Get alarm sound configurations from SOUND_ASSETS
export function getAlarmSounds(): AlarmSoundConfig[] {
  return ALARM_SOUND_KEYS.map((key) => {
    const asset = SOUND_ASSETS[key];
    return {
      key,
      label: asset.label,
      previewSource: asset.previewSource,
      notificationSound: asset.notificationSound,
    };
  });
}

// Get a specific alarm sound config
export function getAlarmSound(key: PrayerSoundKey): AlarmSoundConfig | null {
  if (!ALARM_SOUND_KEYS.includes(key)) {
    return null;
  }

  const asset = SOUND_ASSETS[key];
  return {
    key,
    label: asset.label,
    previewSource: asset.previewSource,
    notificationSound: asset.notificationSound,
  };
}

// Validate if a sound key is valid for alarms
export function isValidAlarmSound(key: string): key is PrayerSoundKey {
  return ALARM_SOUND_KEYS.includes(key as PrayerSoundKey);
}

// ==========================================
// DEFAULT ALARM SOUND
// ==========================================

export const DEFAULT_ALARM_SOUND: PrayerSoundKey = "makkahAthan1";

// ==========================================
// SOUND DURATION ESTIMATES (ms)
// Used for looping calculations on iOS
// ==========================================

// Only include sounds that are valid alarm sounds (PrayerSoundKey)
export const ALARM_SOUND_DURATIONS: Partial<Record<PrayerSoundKey, number>> = {
  makkahAthan1: 180000, // ~3 minutes
  medinaAthan: 180000, // ~3 minutes
  yasserAldosari: 180000, // ~3 minutes
  athan2: 180000, // ~3 minutes
  athan3: 180000, // ~3 minutes
  takbir: 30000, // ~30 seconds
  tasbih: 20000, // ~20 seconds
  beep: 5000, // ~5 seconds
};

// Get duration for a sound, with fallback
export function getAlarmSoundDuration(key: PrayerSoundKey): number {
  return ALARM_SOUND_DURATIONS[key] ?? 60000; // Default to 1 minute
}

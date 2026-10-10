import { BACK_DESTINATION } from "@/constants/BackDestinations";
import type { ScreenshotScreenKey } from "@/constants/Screenshot";

/**
 * Where each capture target lives in the router tree. The Record type catches a
 * missing or unknown key; whether a path resolves is the contract test's job.
 * Separate module so a test can read the map without pulling in expo-router.
 */
export const SCREEN_TO_PATH: Record<ScreenshotScreenKey, string> = {
  "prayer-times": "/(tabs)/",
  "reliable-alarms": "/alarm",
  athkar: "/(tabs)/athkar",
  qibla: "/(tabs)/compass",
  qada: "/(tabs)/qada",
  quran: "/quran",
  "athkar-with-audio": "/athkar-focus",
  tools: "/(tabs)/tools",
  umrah: "/umrah",
  settings: BACK_DESTINATION.SETTINGS.href,
  "settings-appearance": BACK_DESTINATION.SETTINGS_THEME.href,
  "settings-language": BACK_DESTINATION.SETTINGS_LANGUAGE.href,
  "settings-text-size": BACK_DESTINATION.SETTINGS_TEXT_SIZE.href,
  "settings-hijri": BACK_DESTINATION.SETTINGS_HIJRI.href,
  "settings-privacy": BACK_DESTINATION.SETTINGS_PRIVACY.href,
};

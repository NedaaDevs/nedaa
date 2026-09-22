import type { ScreenshotScreenKey } from "@/stores/screenshotStore";

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
};

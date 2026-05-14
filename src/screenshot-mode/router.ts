import * as Linking from "expo-linking";
import { router as expoRouter } from "expo-router";
import { useScreenshotStore, type ScreenshotScreenKey } from "@/stores/screenshotStore";
import { getPreset } from "@/screenshot-mode/presets";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { parseScreenshotDeepLink } from "@/screenshot-mode/parseScreenshotDeepLink";

const SCREEN_TO_PATH: Record<ScreenshotScreenKey, string> = {
  "prayer-times": "/",
  "reliable-alarms": "/alarm",
  athkar: "/athkar",
  qibla: "/compass",
  privacy: "/privacy",
  qada: "/qada",
  quran: "/quran",
  "athkar-with-audio": "/athkar-focus",
};

export function installScreenshotRouter(): (() => void) | undefined {
  if (!IS_SCREENSHOT_MODE) return undefined;
  const sub = Linking.addEventListener("url", ({ url }) => {
    const link = parseScreenshotDeepLink(url);
    if (!link) {
      console.error(`[screenshot] rejected URL: ${url}`);
      return;
    }
    const payload = getPreset(link.screen, link.seed);
    if (payload === null) {
      console.error(`[screenshot] no preset for ${link.screen}/${link.seed}`);
      return;
    }
    useScreenshotStore.getState().setShot({
      screen: link.screen,
      locale: link.locale,
      seed: link.seed,
      payload: payload as Record<string, unknown>,
    });
    expoRouter.replace(SCREEN_TO_PATH[link.screen] as never);
  });
  return () => sub.remove();
}

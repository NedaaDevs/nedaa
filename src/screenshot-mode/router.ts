import * as Linking from "expo-linking";
import { router as expoRouter } from "expo-router";
import { useScreenshotStore, type ScreenshotScreenKey } from "@/stores/screenshotStore";
import { getPreset } from "@/screenshot-mode/presets";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { parseScreenshotDeepLink } from "@/screenshot-mode/parseScreenshotDeepLink";
import { useAppStore } from "@/stores/app";
import { AppLocale } from "@/enums/app";

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

function handleUrl(url: string | null | undefined) {
  if (!url) return;
  console.log(`[screenshot] received URL: ${url}`);
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
  const targetLocale = link.locale === "ar" ? AppLocale.AR : AppLocale.EN;
  if (useAppStore.getState().locale !== targetLocale) {
    console.log(`[screenshot] switching i18n locale to ${targetLocale}`);
    useAppStore.getState().setLocale(targetLocale);
  }
  console.log(`[screenshot] navigating to ${SCREEN_TO_PATH[link.screen]}`);
  expoRouter.replace(SCREEN_TO_PATH[link.screen] as never);
}

export function installScreenshotRouter(): (() => void) | undefined {
  console.log(
    `[screenshot] installScreenshotRouter called, IS_SCREENSHOT_MODE=${IS_SCREENSHOT_MODE}`
  );
  if (!IS_SCREENSHOT_MODE) return undefined;
  Linking.getInitialURL()
    .then(handleUrl)
    .catch((e) => console.error(`[screenshot] getInitialURL failed:`, e));
  const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
  return () => sub.remove();
}

import * as Linking from "expo-linking";
import { router as expoRouter } from "expo-router";
import { useScreenshotStore, type ScreenshotScreenKey } from "@/stores/screenshotStore";
import { getPreset } from "@/screenshot-mode/presets";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { parseScreenshotDeepLink } from "@/screenshot-mode/parseScreenshotDeepLink";
import { seedScreenshotState } from "@/screenshot-mode/seedScreenshotState";
import { useAppStore } from "@/stores/app";
import { AppLocale, AppMode } from "@/enums/app";

// How long to let the target screen mount and settle before re-arming the
// readiness marker. Keeps a single long-lived app session from letting the
// capture fire against the previous screen during an in-place navigation.
const SETTLE_MS = 900;

const SCREEN_TO_PATH: Record<ScreenshotScreenKey, string> = {
  "prayer-times": "/(tabs)/",
  "reliable-alarms": "/alarm",
  athkar: "/(tabs)/athkar",
  qibla: "/(tabs)/compass",
  privacy: "/privacy",
  qada: "/(tabs)/qada",
  quran: "/quran",
  "athkar-with-audio": "/athkar-focus",
  tools: "/(tabs)/tools",
  umrah: "/umrah",
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
  // Clear the readiness marker first so a single long-lived app session can
  // never let the capture fire against the previous screen mid-navigation.
  useScreenshotStore.getState().reset();

  // Location is seeded with city/country localized for the target locale.
  seedScreenshotState(link.locale);

  const targetLocale = link.locale === "ar" ? AppLocale.AR : AppLocale.EN;
  if (useAppStore.getState().locale !== targetLocale) {
    console.log(`[screenshot] switching i18n locale to ${targetLocale}`);
    useAppStore.getState().setLocale(targetLocale);
  }

  // Force a fixed theme so shots are deterministic; default light when omitted.
  const targetMode = link.theme === "dark" ? AppMode.DARK : AppMode.LIGHT;
  if (useAppStore.getState().mode !== targetMode) {
    console.log(`[screenshot] switching theme to ${targetMode}`);
    useAppStore.getState().setMode(targetMode);
  }
  console.log(`[screenshot] navigating to ${SCREEN_TO_PATH[link.screen]}`);
  if (link.screen === "reliable-alarms") {
    // Pass the seeded prayer as alarmType so the screen shows a real (localized)
    // Fajr alarm title instead of the generic CUSTOM fallback.
    const { ringingPrayer } = payload as { ringingPrayer: string };
    expoRouter.replace({
      pathname: SCREEN_TO_PATH[link.screen],
      params: { alarmType: ringingPrayer.toLowerCase() },
    } as never);
  } else {
    expoRouter.replace(SCREEN_TO_PATH[link.screen] as never);
  }

  // Re-arm the readiness marker only after the target screen has had time to
  // mount. The marker is keyed by screen+locale so the Maestro flow waits for
  // *this* capture specifically, even across an in-place navigation.
  setTimeout(() => {
    useScreenshotStore.getState().setShot({
      screen: link.screen,
      locale: link.locale,
      seed: link.seed,
      payload: payload as Record<string, unknown>,
    });
  }, SETTLE_MS);
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

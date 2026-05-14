import {
  useScreenshotStore,
  type ScreenshotScreenKey,
  type ScreenshotState,
} from "@/stores/screenshotStore";
import type { PresetMap } from "@/screenshot-mode/presets";

export function selectScreenshotSeed<K extends ScreenshotScreenKey>(
  state: ScreenshotState,
  screen: K
): PresetMap[K] | null {
  if (state.screen !== screen || state.payload === null) return null;
  return state.payload as PresetMap[K];
}

export function useScreenshotSeed<K extends ScreenshotScreenKey>(screen: K): PresetMap[K] | null {
  const activeScreen = useScreenshotStore((s) => s.screen);
  const payload = useScreenshotStore((s) => s.payload);
  if (activeScreen !== screen || payload === null) return null;
  return payload as PresetMap[K];
}

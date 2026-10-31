import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

/** The one moment every shot shows: Makkah, 2h14m before Dhuhr. */
export const SCREENSHOT_NOW_MS = Date.parse("2026-05-13T10:46:00+03:00");

/** The pinned moment in a screenshot build; null on a live clock. */
export const screenshotNow = (): Date | null =>
  IS_SCREENSHOT_MODE ? new Date(SCREENSHOT_NOW_MS) : null;

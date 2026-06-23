import { z } from "zod";
import type { ScreenshotScreenKey } from "@/stores/screenshotStore";

const SCREEN_KEYS: readonly ScreenshotScreenKey[] = [
  "prayer-times",
  "reliable-alarms",
  "athkar",
  "qibla",
  "privacy",
  "qada",
  "quran",
  "athkar-with-audio",
  "tools",
  "umrah",
] as const;

const schema = z.object({
  screen: z.enum(SCREEN_KEYS as [ScreenshotScreenKey, ...ScreenshotScreenKey[]]),
  locale: z.enum(["en", "ar"]),
  seed: z.string().min(1),
  theme: z.enum(["light", "dark"]).optional(),
});

export type ScreenshotDeepLink = z.infer<typeof schema>;

export function parseScreenshotDeepLink(url: string): ScreenshotDeepLink | null {
  try {
    const parsed = new URL(url);
    const ACCEPTED_PROTOCOLS = new Set(["myapp:", "nedaa:", "dev.nedaa.app:"]);
    if (!ACCEPTED_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.hostname !== "screenshot") return null;
    const screen = parsed.pathname.replace(/^\//, "");
    const locale = parsed.searchParams.get("locale");
    const seed = parsed.searchParams.get("seed");
    const theme = parsed.searchParams.get("theme") ?? undefined;
    const result = schema.safeParse({ screen, locale, seed, theme });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

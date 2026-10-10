import { z } from "zod";
import { SCREENSHOT_LOCALES, SCREENSHOT_SCREENS, SCREENSHOT_THEMES } from "@/constants/Screenshot";

const schema = z.object({
  screen: z.enum(SCREENSHOT_SCREENS),
  locale: z.enum(SCREENSHOT_LOCALES),
  seed: z.string().min(1),
  theme: z.enum(SCREENSHOT_THEMES).optional(),
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

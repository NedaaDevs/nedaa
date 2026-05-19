import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const HEADLINE_KEYS = [
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
  "widgets-1",
  "widgets-2",
] as const;

const entry = z.object({
  headline: z.string().min(1),
  subhead: z.string().optional(),
});

export const headlinesSchema = z.object(
  Object.fromEntries(HEADLINE_KEYS.map((k) => [k, entry])) as Record<
    (typeof HEADLINE_KEYS)[number],
    typeof entry
  >
);

export type Headlines = z.infer<typeof headlinesSchema>;

export function loadHeadlines(locale: "en" | "ar"): Headlines {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(dir, `headlines.${locale}.json`);
  return headlinesSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

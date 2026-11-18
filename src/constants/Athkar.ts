import type { Href } from "expo-router";

import { AppLocale } from "@/enums/app";

export const ATHKAR_TYPE = {
  MORNING: "morning",
  EVENING: "evening",
  ALL: "all",
} as const;

/** The Athkar screen's third tab, beside the two periods. */
export const MY_ATHKAR_TAB = "my-athkar";

/** The languages My Athkar is written in. */
export const MY_ATHKAR_LOCALES: readonly string[] = [AppLocale.AR, AppLocale.EN];

/** Where a new custom group is written. */
export const CUSTOM_ATHKAR_HREF = { NEW: "/custom-athkar/new" } as const satisfies Record<
  string,
  Href
>;

/** The fewest repeats a custom dhikr takes; there is no upper bound. */
export const CUSTOM_DHIKR_REPEATS = { MIN: 1 } as const;

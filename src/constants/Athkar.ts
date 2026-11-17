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

/** Test ids for the parts of My Athkar. */
export const MY_ATHKAR_PART = { EMPTY_ACTIONS: "my-athkar-empty-actions" } as const;

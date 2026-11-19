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

/** Where a custom group is edited. */
export const customAthkarEditHref = (groupId: number): Href => `/custom-athkar/${groupId}`;

/** Which text each count of a group shows: in turn, or each one's repeats together. */
export const ATHKAR_GROUP_ORDER = { BY_ROUND: "byRound", EACH_IN_FULL: "eachInFull" } as const;

export type AthkarGroupOrder = (typeof ATHKAR_GROUP_ORDER)[keyof typeof ATHKAR_GROUP_ORDER];

/** Every group order, in the order a person is offered them. */
export const ATHKAR_GROUP_ORDERS: readonly AthkarGroupOrder[] = Object.values(ATHKAR_GROUP_ORDER);

/** The order a group takes until a person chooses one. */
export const DEFAULT_ATHKAR_GROUP_ORDER: AthkarGroupOrder = ATHKAR_GROUP_ORDER.BY_ROUND;

export const isAthkarGroupOrder = (value: unknown): value is AthkarGroupOrder =>
  ATHKAR_GROUP_ORDERS.some((order) => order === value);

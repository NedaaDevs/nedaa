import type { ParseKeys } from "i18next";

export const ZONE_DIRECTION = { AHEAD: "ahead", BEHIND: "behind" } as const;
export type ZoneDirection = (typeof ZONE_DIRECTION)[keyof typeof ZONE_DIRECTION];

export const ZONE_UNIT = { HOURS: "hours", HALF_HOURS: "halfHours", MINUTES: "minutes" } as const;
export type ZoneUnit = (typeof ZONE_UNIT)[keyof typeof ZONE_UNIT];

/** Copy for how far one clock runs from another, by direction and unit. */
export const ZONE_COPY_KEY: Record<ZoneDirection, Record<ZoneUnit, ParseKeys>> = {
  [ZONE_DIRECTION.AHEAD]: {
    [ZONE_UNIT.HOURS]: "location.zone.ahead.hours",
    [ZONE_UNIT.HALF_HOURS]: "location.zone.ahead.halfHours",
    [ZONE_UNIT.MINUTES]: "location.zone.ahead.minutes",
  },
  [ZONE_DIRECTION.BEHIND]: {
    [ZONE_UNIT.HOURS]: "location.zone.behind.hours",
    [ZONE_UNIT.HALF_HOURS]: "location.zone.behind.halfHours",
    [ZONE_UNIT.MINUTES]: "location.zone.behind.minutes",
  },
};

/** Where the offer card stands: asked, answered, or settled. */
export const CITY_OFFER_STAGE = {
  OFFER: "offer",
  KEPT: "kept",
  MUTED: "muted",
  UPDATED: "updated",
} as const;
export type CityOfferStageKind = (typeof CITY_OFFER_STAGE)[keyof typeof CITY_OFFER_STAGE];

/** How the device's city and the saved city name each other. */
export const OFFER_SHAPE = {
  NAMED: "named",
  SAME_NAME: "sameName",
  UNNAMED: "unnamed",
} as const;
export type OfferShape = (typeof OFFER_SHAPE)[keyof typeof OFFER_SHAPE];

/** What the offer card draws. */
export const OFFER_VIEW = {
  OFFER: "offer",
  UPDATING: "updating",
  FAILED: "failed",
  NOT_APPLIED: "notApplied",
  STOPPED: "stopped",
  UPDATED: "updated",
  KEPT: "kept",
  MUTED: "muted",
} as const;
export type OfferView = (typeof OFFER_VIEW)[keyof typeof OFFER_VIEW];

/** Test ids for the offer card. */
export const CITY_OFFER_PART = { CARD: "city-offer-card" } as const;

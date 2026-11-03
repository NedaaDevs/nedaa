import type { CITY_OFFER_STAGE } from "@/constants/CityOffer";
import type { CityCheckEnd, CityCheckNeed, CityCheckOfferReason } from "@/constants/CityCheck";
import type { FixSource } from "@/constants/Location";
import type { LocalizedNames } from "@/types/cities";
import type { Coords } from "@/types/location";
import type { AladhanMadhabId, MethodId } from "@/types/providers/aladhan";

/** A remembered point, rounded, when it was made and its upper-case ISO country when known. */
export type PlaceMark = { lat: number; lng: number; at: number; countryCode?: string | null };

export type LocalizedPlaceName = { name: string; names: LocalizedNames | null };

/** A place as the zone line names it; a saved device place can have no name. */
export type ZonePlace = { city: string | null; zone: string | null };

export type CityCheckFix = {
  point: Coords;
  accuracyKm: number | null;
  fixedAt: number;
  source: FixSource;
};

export type SavedPlaceFacts = {
  point: Coords;
  accuracyKm: number | null;
  zone: string;
  countryCode: string | null;
};

export type CityCandidate = {
  point: Coords;
  accuracyKm: number | null;
  fixedAt: number;
  zone: string | null;
  countryCode: string | null;
  name: LocalizedPlaceName | null;
  distanceKm: number;
};

export type ShiftCalc = { method: MethodId; school: AladhanMadhabId };

/** Null when the user chose the method, so a place cannot change it. */
export type MethodFacts = { saved: MethodId; candidate: MethodId } | null;

export type CityCheckFacts = {
  now: number;
  saved: SavedPlaceFacts;
  fixes: CityCheckFix[];
  candidate: CityCandidate | null;
  countryLooked: boolean;
  methods: MethodFacts;
  calc: ShiftCalc;
  kept: PlaceMark[];
  notAsked: PlaceMark[];
};

export type CityOfferStage =
  | { kind: typeof CITY_OFFER_STAGE.OFFER }
  | { kind: typeof CITY_OFFER_STAGE.KEPT }
  | { kind: typeof CITY_OFFER_STAGE.MUTED }
  | { kind: typeof CITY_OFFER_STAGE.UPDATED; alertsFollow: boolean };

export type CityOffer = {
  candidate: CityCandidate;
  reasons: CityCheckOfferReason[];
  stage: CityOfferStage;
  /** Whether the card's appearance has been announced to a screen reader. */
  announced: boolean;
  /** The saved place the times came from when Use started. */
  from: ZonePlace | null;
};

export type CityCheckVerdict =
  | { offer: true; candidate: CityCandidate; reasons: CityCheckOfferReason[] }
  | { offer: false; reason: CityCheckNeed | CityCheckEnd };

export type CityCheckMemory = {
  lastCheckAt: number | null;
  lastPhoneZone: string | null;
  kept: PlaceMark[];
  notAsked: PlaceMark[];
};

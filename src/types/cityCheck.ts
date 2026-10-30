import type { CityCheckEnd, CityCheckNeed, CityCheckOfferReason } from "@/constants/CityCheck";
import type { FixSource } from "@/constants/Location";
import type { LocalizedNames } from "@/types/cities";
import type { Coords } from "@/types/location";
import type { AladhanMadhabId, MethodId } from "@/types/providers/aladhan";

/** A remembered point, rounded, when it was made and its upper-case ISO country when known. */
export type PlaceMark = { lat: number; lng: number; at: number; countryCode?: string | null };

export type LocalizedPlaceName = { name: string; names: LocalizedNames | null };

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

export type CityOffer = { candidate: CityCandidate; reasons: CityCheckOfferReason[] };

export type CityCheckVerdict =
  ({ offer: true } & CityOffer) | { offer: false; reason: CityCheckNeed | CityCheckEnd };

export type CityCheckMemory = {
  lastCheckAt: number | null;
  lastPhoneZone: string | null;
  kept: PlaceMark[];
  notAsked: PlaceMark[];
};

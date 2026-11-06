import type { Coords } from "@/types/location";

/** Kilometres in one degree of latitude on the mean Earth sphere. */
const KM_PER_DEGREE = 111.195;
const RAD = Math.PI / 180;

/** The point `km` due east of `from`. */
export const eastOf = (from: Coords, km: number): Coords => ({
  latitude: from.latitude,
  longitude: from.longitude + km / (KM_PER_DEGREE * Math.cos(from.latitude * RAD)),
});

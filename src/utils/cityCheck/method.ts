import { METHOD_AUTHORITY, METHOD_BY_COUNTRY } from "@/constants/aladhanMethods";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import type { Coords } from "@/types/location";
import type { MethodId } from "@/types/providers/aladhan";
import { distanceBetween } from "@/utils/location";

type Authority = { id: MethodId; point: Coords };

const AUTHORITIES: Authority[] = PRAYER_TIME_PROVIDERS.ALADHAN.methods.flatMap(({ id }) => {
  const point = METHOD_AUTHORITY[id];
  return point ? [{ id, point }] : [];
});

const hasCountryMethod = (code: string): code is keyof typeof METHOD_BY_COUNTRY =>
  Object.hasOwn(METHOD_BY_COUNTRY, code);

/** AlAdhan's default method: the country's own, else the nearest authority. */
export const providerMethodAt = (point: Coords, countryCode: string | null): MethodId => {
  const code = countryCode?.toUpperCase() ?? null;
  if (code && hasCountryMethod(code)) return METHOD_BY_COUNTRY[code];
  const nearest = AUTHORITIES.reduce((best, authority) =>
    distanceBetween(point, authority.point) < distanceBetween(point, best.point) ? authority : best
  );
  return nearest.id;
};

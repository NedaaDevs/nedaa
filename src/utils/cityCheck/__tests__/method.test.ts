import { COUNTRY_CODE, METHOD_AUTHORITY } from "@/constants/aladhanMethods";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import type { Coords } from "@/types/location";
import type { MethodId } from "@/types/providers/aladhan";

import { providerMethodAt } from "@/utils/cityCheck/method";

const SA = COUNTRY_CODE.SAUDI_ARABIA;

type Sample = [name: string, point: Coords, countryCode: string | null, method: MethodId];

const at = (latitude: number, longitude: number): Coords => ({ latitude, longitude });

// api.aladhan.com/v1/timings with no method, sampled 2026-10-29.
const SAMPLED: Sample[] = [
  ["Makkah", at(21.4225, 39.8262), SA, 4],
  ["Riyadh", at(24.7136, 46.6753), SA, 4],
  ["Dubai", at(25.2048, 55.2708), "AE", 16],
  ["Doha", at(25.2854, 51.531), "QA", 10],
  ["Kuwait", at(29.3759, 47.9774), "KW", 9],
  ["Manama", at(26.2285, 50.586), "BH", 10],
  ["Cairo", at(30.0444, 31.2357), "EG", 5],
  ["Amman", at(31.9454, 35.9284), "JO", 23],
  ["London", at(51.5074, -0.1278), "GB", 3],
  ["Paris", at(48.8566, 2.3522), "FR", 12],
  ["New York", at(40.7128, -74.006), "US", 2],
  ["Karachi", at(24.8607, 67.0011), "PK", 1],
  ["Istanbul", at(41.0082, 28.9784), "TR", 13],
  ["Kuala Lumpur", at(3.139, 101.6869), "MY", 17],
  ["Singapore", at(1.3521, 103.8198), "SG", 11],
  ["Johor Bahru", at(1.4927, 103.7414), "MY", 11],
  ["Jakarta", at(-6.2088, 106.8456), "ID", 20],
  ["Rabat", at(34.0209, -6.8416), "MA", 21],
  ["Abu Dhabi", at(24.4539, 54.3773), "AE", 16],
  ["Tehran", at(35.69, 51.39), "IR", 7],
  ["Qom", at(34.64, 50.87), "IR", 0],
  ["Salalah", at(17.02, 54.09), "OM", 8],
  ["Moscow", at(55.75, 37.62), "RU", 14],
  ["Lisbon", at(38.72, -9.14), "PT", 22],
  ["Tunis", at(36.81, 10.18), "TN", 18],
  ["Algiers", at(36.75, 3.06), "DZ", 19],
  ["Sydney", at(-33.87, 151.21), "AU", 20],
  ["Khafji", at(28.43, 48.49), SA, 4],
  ["Wafra", at(28.63, 47.93), "KW", 9],
  ["Salwa", at(24.75, 50.8), SA, 4],
  ["Abu Samra", at(24.7, 51.6), "QA", 10],
  ["Tabuk", at(28.38, 36.57), SA, 4],
  ["Aqaba", at(29.53, 35.0), "JO", 23],
];

const MOONSIGHTING: MethodId = 15;
const QATAR: MethodId = 10;

describe("providerMethodAt", () => {
  it.each(SAMPLED)("picks AlAdhan's method at %s", (_, point, countryCode, id) =>
    expect(providerMethodAt(point, countryCode)).toBe(id)
  );

  it("picks the nearest authority inside Saudi Arabia when the country is unknown", () => {
    const [, riyadh] = SAMPLED[1];
    expect(providerMethodAt(riyadh, null)).toBe(QATAR);
  });

  it("never picks a method with no authority point", () => {
    expect(METHOD_AUTHORITY[MOONSIGHTING]).toBeNull();
    SAMPLED.forEach(([, point, countryCode]) =>
      expect(providerMethodAt(point, countryCode)).not.toBe(MOONSIGHTING)
    );
  });

  it("holds an authority entry for every method the app offers", () => {
    const offered = PRAYER_TIME_PROVIDERS.ALADHAN.methods.map(({ id }) => String(id));
    expect(Object.keys(METHOD_AUTHORITY).sort()).toEqual([...offered].sort());
  });
});

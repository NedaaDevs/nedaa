import { CITY_ROW_TRUST_KM } from "@/constants/CityCheck";
import { JEDDAH_ROW } from "@/test-helpers/cityRows";
import type { Coords } from "@/types/location";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";

const mockFindNearestCity = jest.fn();

jest.mock("@/services/cities-db", () => ({
  CitiesDB: { findNearestCity: (...args: unknown[]) => mockFindNearestCity(...args) },
}));

const JEDDAH_POINT: Coords = { latitude: 21.5433, longitude: 39.1728 };

beforeEach(() => mockFindNearestCity.mockReset());

it("returns the nearest row within 25 km", async () => {
  mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: 3 });

  await expect(trustedCityNear(JEDDAH_POINT)).resolves.toBe(JEDDAH_ROW);
  expect(mockFindNearestCity).toHaveBeenCalledWith(JEDDAH_POINT.latitude, JEDDAH_POINT.longitude);
});

it("returns a row exactly 25 km away", async () => {
  mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: CITY_ROW_TRUST_KM });

  await expect(trustedCityNear(JEDDAH_POINT)).resolves.toBe(JEDDAH_ROW);
});

it.each<[string, () => void]>([
  [
    "farther than 25 km",
    () =>
      mockFindNearestCity.mockResolvedValue({
        city: JEDDAH_ROW,
        distanceKm: CITY_ROW_TRUST_KM + 0.1,
      }),
  ],
  ["absent", () => mockFindNearestCity.mockResolvedValue(null)],
  ["a throw", () => mockFindNearestCity.mockRejectedValue(new Error("db"))],
])("returns null for a row %s", async (_case, arrange) => {
  arrange();

  await expect(trustedCityNear(JEDDAH_POINT)).resolves.toBeNull();
});

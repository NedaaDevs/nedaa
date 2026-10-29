import {
  CITY_CHECK_END,
  CITY_CHECK_NEED,
  CITY_CHECK_OFFER,
  CITY_CHECK_REASON,
  CITY_CHECK_SKIP,
} from "@/constants/CityCheck";

describe("city-check reasons", () => {
  it("gives every reason a distinct value", () => {
    const values = Object.values(CITY_CHECK_REASON);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps every group's keys in the merged reasons", () => {
    const groups = [CITY_CHECK_SKIP, CITY_CHECK_NEED, CITY_CHECK_END, CITY_CHECK_OFFER];
    const total = groups.reduce((n, group) => n + Object.keys(group).length, 0);
    expect(Object.keys(CITY_CHECK_REASON).length).toBe(total);
  });
});

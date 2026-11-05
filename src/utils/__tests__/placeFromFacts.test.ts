import { timesMoved } from "@/utils/placeFromFacts";

const RIYADH = { latitude: 24.7136, longitude: 46.6753 };
const JEDDAH = { latitude: 21.4858, longitude: 39.1925 };
const NEARBY = { latitude: RIYADH.latitude + 0.005, longitude: RIYADH.longitude - 0.005 };

describe("timesMoved", () => {
  it.each([
    ["another place's days", RIYADH, false, JEDDAH, true],
    ["the place's own days", RIYADH, false, RIYADH, false],
    ["drift inside the same place", RIYADH, false, NEARBY, false],
    ["days not marked yet", null, false, JEDDAH, false],
    ["split days at their marked place", RIYADH, true, RIYADH, true],
    ["split days not marked yet", null, true, RIYADH, true],
  ])("for %s", (_name, timesCoords, timesSplit, place, moved) => {
    expect(timesMoved({ timesCoords, timesSplit }, place)).toBe(moved);
  });
});

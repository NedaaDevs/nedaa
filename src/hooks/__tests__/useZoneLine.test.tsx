import { renderHook } from "@testing-library/react-native";

import { ZONE_LINE, type ZoneLine } from "@/constants/CityOffer";
import { useZoneLine } from "@/hooks/useZoneLine";
import i18n from "@/localization/i18n";
import { ThemeProvider } from "@/test-helpers/theme";
import type { ZonePlace } from "@/types/cityCheck";

const RIYADH: ZonePlace = { city: "Riyadh", zone: "Asia/Riyadh" };
const DUBAI: ZonePlace = { city: "Dubai", zone: "Asia/Dubai" };

const line = async (place: ZonePlace, other: ZonePlace, variant?: ZoneLine) => {
  const { result } = await renderHook(() => useZoneLine(place, other, variant), {
    wrapper: ThemeProvider,
  });
  return result.current;
};

describe("useZoneLine", () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date(Date.UTC(2026, 0, 15, 12)) }));
  afterEach(() => jest.useRealTimers());

  it("says how far ahead the place's clock is, naming both cities", async () =>
    expect(await line(DUBAI, RIYADH)).toBe(
      i18n.t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" })
    ));

  it("says how far behind the place's clock is", async () =>
    expect(await line({ city: "Cairo", zone: "Africa/Cairo" }, RIYADH)).toBe(
      i18n.t("location.zone.behind.hours", { count: 1, place: "Cairo", other: "Riyadh" })
    ));

  it.each([["Asia/Kuwait"], [null]])("says nothing beside %s", async (zone) =>
    expect(await line({ city: "Kuwait", zone }, RIYADH)).toBeNull()
  );

  it("says nothing beside a zone it cannot read", async () =>
    expect(await line({ city: "Olympus", zone: "Mars/Olympus" }, RIYADH)).toBeNull());

  it("says nothing beside a place with no name", async () => {
    expect(await line(DUBAI, { city: null, zone: "Asia/Riyadh" })).toBeNull();
    expect(await line({ city: null, zone: "Asia/Dubai" }, RIYADH)).toBeNull();
  });

  it("says the note from the saved place's side", async () =>
    expect(await line(DUBAI, RIYADH, ZONE_LINE.NOTE)).toBe(
      i18n.t("location.zone.note.behind.hours", { count: 1, saved: "Riyadh", place: "Dubai" })
    ));

  it("says the note ahead when the kept place is behind the saved one", async () =>
    expect(await line({ city: "Cairo", zone: "Africa/Cairo" }, RIYADH, ZONE_LINE.NOTE)).toBe(
      i18n.t("location.zone.note.ahead.hours", { count: 1, saved: "Riyadh", place: "Cairo" })
    ));

  it("says no note beside an unnamed place or an equal clock", async () => {
    expect(await line(DUBAI, { city: null, zone: "Asia/Riyadh" }, ZONE_LINE.NOTE)).toBeNull();
    expect(await line({ city: "Kuwait", zone: "Asia/Kuwait" }, RIYADH, ZONE_LINE.NOTE)).toBeNull();
  });
});

import { renderHook } from "@testing-library/react-native";

import { useZoneLine, useZoneNote } from "@/hooks/useZoneLine";
import i18n from "@/localization/i18n";
import { ThemeProvider } from "@/test-helpers/theme";
import type { ZonePlace } from "@/types/cityCheck";

const RIYADH: ZonePlace = { city: "Riyadh", zone: "Asia/Riyadh" };
const DUBAI: ZonePlace = { city: "Dubai", zone: "Asia/Dubai" };

const hookResult = async (hook: () => string | null) => {
  const { result } = await renderHook(hook, { wrapper: ThemeProvider });
  return result.current;
};
const line = (place: ZonePlace, other: ZonePlace) => hookResult(() => useZoneLine(place, other));
const note = (place: ZonePlace, saved: ZonePlace) => hookResult(() => useZoneNote(place, saved));

describe("useZoneLine and useZoneNote", () => {
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
    expect(await note(DUBAI, RIYADH)).toBe(
      i18n.t("location.zone.note.behind.hours", { count: 1, saved: "Riyadh", place: "Dubai" })
    ));

  it("says the note ahead when the kept place is behind the saved one", async () =>
    expect(await note({ city: "Cairo", zone: "Africa/Cairo" }, RIYADH)).toBe(
      i18n.t("location.zone.note.ahead.hours", { count: 1, saved: "Riyadh", place: "Cairo" })
    ));

  it("says no note beside an unnamed place or an equal clock", async () => {
    expect(await note(DUBAI, { city: null, zone: "Asia/Riyadh" })).toBeNull();
    expect(await note({ city: "Kuwait", zone: "Asia/Kuwait" }, RIYADH)).toBeNull();
  });
});

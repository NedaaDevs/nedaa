import { fromZonedTime } from "date-fns-tz";
import { SAME_OCCURRENCE_WINDOW_MS } from "@/constants/PrayerOccurrence";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { hasFired, notificationKey, pruneLedger } from "@/utils/firedPrayerGuard";

const at = (iso: string) => new Date(iso).getTime();
const wall = (local: string, zone: string) => fromZonedTime(local, zone).getTime();
const MINUTE = 60_000;
const MAGHRIB = notificationKey(NOTIFICATION_TYPE.PRAYER, "maghrib");
const ISHA = notificationKey(NOTIFICATION_TYPE.PRAYER, "isha");
const FIRED = [{ key: MAGHRIB, at: at("2026-10-26T14:30:00Z") }];

describe("hasFired", () => {
  it("treats the same prayer moved later by a same-zone move west as fired", () => {
    expect(hasFired(FIRED, MAGHRIB, at("2026-10-26T14:56:00Z"), at("2026-10-26T14:35:00Z"))).toBe(
      true
    );
  });
  it("books the next day's occurrence", () => {
    expect(hasFired(FIRED, MAGHRIB, at("2026-10-27T14:31:00Z"), at("2026-10-26T14:35:00Z"))).toBe(
      false
    );
  });
  it("ignores a booking whose instant has not passed", () => {
    expect(hasFired(FIRED, MAGHRIB, at("2026-10-26T14:56:00Z"), at("2026-10-26T14:29:00Z"))).toBe(
      false
    );
  });
  it("counts a booking at exactly now as fired", () => {
    expect(hasFired(FIRED, MAGHRIB, at("2026-10-26T14:56:00Z"), at("2026-10-26T14:30:00Z"))).toBe(
      true
    );
  });
  it("matches only the same alert kind and prayer", () => {
    const next = at("2026-10-26T14:56:00Z");
    const now = at("2026-10-26T14:35:00Z");
    expect(hasFired(FIRED, notificationKey(NOTIFICATION_TYPE.IQAMA, "maghrib"), next, now)).toBe(
      false
    );
    expect(hasFired(FIRED, ISHA, next, now)).toBe(false);
  });
  it("splits the same occurrence from the next one at 12 hours", () => {
    const firedAt = FIRED[0].at;
    expect(
      hasFired(FIRED, MAGHRIB, firedAt + SAME_OCCURRENCE_WINDOW_MS - 1, firedAt + MINUTE)
    ).toBe(true);
    expect(hasFired(FIRED, MAGHRIB, firedAt + SAME_OCCURRENCE_WINDOW_MS, firedAt + MINUTE)).toBe(
      false
    );
  });
  it.each([
    [
      "Isha past midnight after a move west",
      wall("2026-10-26T23:50", "Asia/Riyadh"),
      wall("2026-10-27T00:15", "Asia/Riyadh"),
      wall("2026-10-27T00:05", "Asia/Riyadh"),
      true,
    ],
    [
      "Dubai to Riyadh, zones differ",
      wall("2026-10-26T19:10", "Asia/Dubai"),
      wall("2026-10-26T19:00", "Asia/Riyadh"),
      at("2026-10-26T15:30:00Z"),
      true,
    ],
    [
      "Riyadh to New York on the same date",
      wall("2026-10-26T19:00", "Asia/Riyadh"),
      wall("2026-10-26T19:15", "America/New_York"),
      at("2026-10-26T20:00:00Z"),
      true,
    ],
    [
      "Tokyo to Honolulu across the date line",
      wall("2026-10-27T18:40", "Asia/Tokyo"),
      wall("2026-10-27T19:05", "Pacific/Honolulu"),
      at("2026-10-27T20:00:00Z"),
      false,
    ],
    [
      "Riyadh to Tokyo eastward",
      wall("2026-10-26T19:00", "Asia/Riyadh"),
      wall("2026-10-27T18:40", "Asia/Tokyo"),
      at("2026-10-27T00:00:00Z"),
      false,
    ],
    [
      "New York across the end of daylight time",
      wall("2026-10-31T19:00", "America/New_York"),
      wall("2026-11-01T18:00", "America/New_York"),
      at("2026-11-01T12:00:00Z"),
      false,
    ],
  ])("%s", (_case, firedAt, nextAt, now, expected) => {
    expect(hasFired([{ key: ISHA, at: firedAt }], ISHA, nextAt, now)).toBe(expected);
  });
});

describe("pruneLedger", () => {
  it("drops entries a full window old and keeps the rest", () => {
    const now = at("2026-10-26T14:00:00Z");
    const old = { key: ISHA, at: now - SAME_OCCURRENCE_WINDOW_MS };
    const recent = { key: ISHA, at: now - SAME_OCCURRENCE_WINDOW_MS + 1 };
    const booked = { key: ISHA, at: now + 60 * MINUTE };
    expect(pruneLedger([old, recent, booked], now)).toEqual([recent, booked]);
  });
});

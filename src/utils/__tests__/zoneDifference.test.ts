import {
  zoneCopyOf,
  zoneDifferenceMinutes,
  zoneNoteOf,
  zoneOffsetMinutes,
} from "@/utils/zoneDifference";

const JAN = Date.UTC(2026, 0, 15, 12);
const JUL = Date.UTC(2026, 6, 15, 12);
const UNREADABLE_ZONE = "Mars/Olympus";

describe("zoneDifferenceMinutes", () => {
  it.each([
    ["Asia/Riyadh", "Asia/Dubai", JAN, 60],
    ["Asia/Riyadh", "Africa/Cairo", JAN, -60],
    ["Asia/Riyadh", "Asia/Kolkata", JAN, 150],
    ["Asia/Riyadh", "Asia/Kathmandu", JAN, 165],
    ["Asia/Riyadh", "Asia/Kuwait", JAN, 0],
    ["Asia/Riyadh", "Europe/London", JAN, -180],
    ["Asia/Riyadh", "Europe/London", JUL, -120],
  ])("puts %s and %s %#: %d minutes apart", (from, to, at, minutes) =>
    expect(zoneDifferenceMinutes(from, to, at)).toBe(minutes)
  );

  it("knows no difference for a zone it cannot read", () => {
    expect(zoneDifferenceMinutes("Asia/Riyadh", UNREADABLE_ZONE, JAN)).toBeNull();
    expect(zoneDifferenceMinutes(UNREADABLE_ZONE, "Asia/Riyadh", JAN)).toBeNull();
  });
});

describe("zoneOffsetMinutes", () => {
  it("reads the offset from UTC", () => expect(zoneOffsetMinutes("Asia/Riyadh", JAN)).toBe(180));
  it("knows no offset for a zone it cannot read", () =>
    expect(zoneOffsetMinutes(UNREADABLE_ZONE, JAN)).toBeNull());
});

describe("zoneCopyOf", () => {
  it.each([
    [60, "location.zone.ahead.hours", 1],
    [-120, "location.zone.behind.hours", 2],
    [150, "location.zone.ahead.halfHours", 2],
    [30, "location.zone.ahead.halfHours", 0],
    [165, "location.zone.ahead.minutes", 165],
    [-345, "location.zone.behind.minutes", 345],
  ])("words %d minutes with %s, count %d", (minutes, key, count) =>
    expect(zoneCopyOf(minutes)).toEqual({ key, count })
  );

  it("words no difference as nothing", () => expect(zoneCopyOf(0)).toBeNull());
});

describe("zoneNoteOf", () => {
  it.each([
    [60, "location.zone.note.behind.hours", 1],
    [-120, "location.zone.note.ahead.hours", 2],
    [150, "location.zone.note.behind.halfHours", 2],
    [30, "location.zone.note.behind.halfHours", 0],
    [165, "location.zone.note.behind.minutes", 165],
    [-345, "location.zone.note.ahead.minutes", 345],
  ])("words %d minutes for the note with %s, count %d", (minutes, key, count) =>
    expect(zoneNoteOf(minutes)).toEqual({ key, count })
  );

  it("words no difference as no note", () => expect(zoneNoteOf(0)).toBeNull());

  // Both wordings read one difference with the same unit and count.
  it.each([-345, -150, -60, -30, 30, 60, 150, 165])(
    "counts %d minutes as zoneCopyOf does",
    (minutes) => expect(zoneNoteOf(minutes)?.count).toBe(zoneCopyOf(minutes)?.count)
  );
});

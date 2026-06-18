import { computeNextOccurrence } from "@/utils/reminders/computeNextOccurrence";
import { Weekday } from "@/enums/quranReminders";

const weekly = { freq: "weekly", weekday: Weekday.FRIDAY, hour: 9, minute: 0 } as const;

describe("computeNextOccurrence — weekly", () => {
  it("returns this Friday 09:00 when now is earlier in the week", () => {
    // 2026-06-15 is a Monday.
    const now = new Date(2026, 5, 15, 8, 0, 0);
    const next = computeNextOccurrence(weekly, now);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(19); // Friday 2026-06-19
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getSeconds()).toBe(0);
  });
  it("rolls to next Friday when it is already Friday past the time", () => {
    const now = new Date(2026, 5, 19, 10, 0, 0); // Fri 10:00, after 09:00
    const next = computeNextOccurrence(weekly, now);
    expect(next.getDate()).toBe(26); // next Friday
  });
  it("returns today when it is Friday before the time", () => {
    const now = new Date(2026, 5, 19, 7, 30, 0); // Fri 07:30, before 09:00
    const next = computeNextOccurrence(weekly, now);
    expect(next.getDate()).toBe(19);
    expect(next.getHours()).toBe(9);
  });
});

describe("computeNextOccurrence — daily", () => {
  const daily = { freq: "daily", hour: 6, minute: 30 } as const;
  it("returns tomorrow when today's time has passed", () => {
    const now = new Date(2026, 5, 15, 7, 0, 0);
    const next = computeNextOccurrence(daily, now);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(6);
    expect(next.getMinutes()).toBe(30);
  });
  it("returns today when today's time is still ahead", () => {
    const now = new Date(2026, 5, 15, 5, 0, 0);
    const next = computeNextOccurrence(daily, now);
    expect(next.getDate()).toBe(15);
  });
});

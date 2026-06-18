import { Weekday, weekdayToExpo, QURAN_REMINDER_ID } from "@/enums/quranReminders";

describe("Weekday enum + expo mapping", () => {
  it("uses JS getDay semantics (Sunday=0, Friday=5)", () => {
    expect(Weekday.SUNDAY).toBe(0);
    expect(Weekday.FRIDAY).toBe(5);
    expect(Weekday.SATURDAY).toBe(6);
  });
  it("maps JS weekday to expo 1-7 (Friday -> 6)", () => {
    expect(weekdayToExpo(Weekday.SUNDAY)).toBe(1);
    expect(weekdayToExpo(Weekday.FRIDAY)).toBe(6);
    expect(weekdayToExpo(Weekday.SATURDAY)).toBe(7);
  });
  it("exposes the stable Al-Kahf reminder id", () => {
    expect(QURAN_REMINDER_ID).toBe("al-kahf");
  });
});

import { formatHoursMinutes } from "@/utils/countdown";

describe("formatHoursMinutes", () => {
  it("pads the minutes so the width stays stable as it counts down", () => {
    expect(formatHoursMinutes(2 * 3600 + 6 * 60)).toBe("2:06");
    expect(formatHoursMinutes(2 * 3600 + 30 * 60)).toBe("2:30");
  });

  it("keeps the hour slot under an hour rather than dropping to bare minutes", () => {
    expect(formatHoursMinutes(35 * 60)).toBe("0:35");
  });

  it("floors, so a partly-elapsed minute is not rounded up", () => {
    expect(formatHoursMinutes(3600 + 59)).toBe("1:00");
    expect(formatHoursMinutes(119)).toBe("0:01");
  });

  it("carries hours past a day rather than wrapping", () => {
    expect(formatHoursMinutes(26 * 3600 + 5 * 60)).toBe("26:05");
  });

  // A next timing that reads as past — stale cached data, mainly — must show
  // zero rather than counting backwards.
  it("clamps a negative interval to zero", () => {
    expect(formatHoursMinutes(-7 * 3600)).toBe("0:00");
    expect(formatHoursMinutes(0)).toBe("0:00");
  });
});

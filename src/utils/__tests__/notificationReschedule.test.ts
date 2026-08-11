import { shouldForceReschedule, summarizeSchedulingResult } from "@/utils/notificationReschedule";

describe("shouldForceReschedule", () => {
  it("forces a reschedule only when permission has just become granted", () => {
    // newly granted (returned from system settings with it enabled) → force
    expect(shouldForceReschedule(false, true)).toBe(true);
    // already granted → no force; the guarded path handles same-day skips
    expect(shouldForceReschedule(true, true)).toBe(false);
    // not granted now → nothing to schedule
    expect(shouldForceReschedule(true, false)).toBe(false);
    expect(shouldForceReschedule(false, false)).toBe(false);
  });
});

describe("summarizeSchedulingResult", () => {
  it("maps a skip to a skipped entry with the reason, regardless of success", () => {
    expect(
      summarizeSchedulingResult({
        success: false,
        scheduledCount: 0,
        skipReason: "permissionNotGranted",
      })
    ).toEqual({ result: "skipped", details: "nothing scheduled: permissionNotGranted" });

    // notifications disabled reports success:true but is still a skip
    expect(
      summarizeSchedulingResult({
        success: true,
        scheduledCount: 0,
        skipReason: "notificationsDisabled",
      })
    ).toEqual({ result: "skipped", details: "nothing scheduled: notificationsDisabled" });
  });

  it("maps a failure to a failed entry with the error message", () => {
    expect(
      summarizeSchedulingResult({
        success: false,
        scheduledCount: 0,
        error: new Error("boom"),
      })
    ).toEqual({ result: "failed", details: "boom" });

    expect(summarizeSchedulingResult({ success: false, scheduledCount: 0 })).toEqual({
      result: "failed",
      details: "unknown scheduling error",
    });
  });

  it("maps a success to the count and the horizon end", () => {
    expect(
      summarizeSchedulingResult({
        success: true,
        scheduledCount: 42,
        lastScheduledAt: "2026-08-20T19:12:00.000Z",
      })
    ).toEqual({ result: "success", details: "scheduled 42 through 2026-08-20T19:12:00.000Z" });

    // a partial run stays a success but surfaces the failure count
    expect(
      summarizeSchedulingResult({
        success: true,
        scheduledCount: 40,
        failedCount: 2,
        lastScheduledAt: "2026-08-20T19:12:00.000Z",
      })
    ).toEqual({
      result: "success",
      details: "scheduled 40 through 2026-08-20T19:12:00.000Z, 2 failed",
    });

    // a run with nothing in the future has no horizon
    expect(summarizeSchedulingResult({ success: true, scheduledCount: 0 })).toEqual({
      result: "success",
      details: "scheduled 0",
    });
  });
});

import { shouldForceReschedule } from "@/utils/notificationReschedule";

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

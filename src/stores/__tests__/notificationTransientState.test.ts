import { clearTransientSchedulingState } from "@/stores/notificationTransientState";

describe("clearTransientSchedulingState", () => {
  it("clears a scheduling lock left behind by a dead process", () => {
    const state = { isScheduling: true };

    clearTransientSchedulingState(state);

    expect(state.isScheduling).toBe(false);
  });

  it("leaves an already-clear lock alone", () => {
    const state = { isScheduling: false };

    clearTransientSchedulingState(state);

    expect(state.isScheduling).toBe(false);
  });

  it("keeps the rest of the persisted state untouched", () => {
    const state = {
      isScheduling: true,
      batchDepth: 3,
      pendingReschedule: true,
      lastScheduledDate: "2026-09-09T00:00:00.000Z",
      migrationVersion: 6,
    };

    clearTransientSchedulingState(state);

    expect(state).toEqual({
      isScheduling: false,
      batchDepth: 0,
      // Work the app owes is settings-like, not transient: the next launch pays it.
      pendingReschedule: true,
      lastScheduledDate: "2026-09-09T00:00:00.000Z",
      migrationVersion: 6,
    });
  });

  it("tolerates a state rehydrated without the field", () => {
    const state = { lastScheduledDate: null } as {
      lastScheduledDate: null;
      isScheduling?: boolean;
    };

    expect(() => clearTransientSchedulingState(state)).not.toThrow();
    expect(state.isScheduling).toBe(false);
  });
});

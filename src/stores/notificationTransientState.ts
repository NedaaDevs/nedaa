/** The slice of the notification store that describes work in progress rather than settings. */
type TransientSchedulingState = {
  isScheduling?: boolean;
};

/**
 * Clears the scheduling lock during rehydration.
 *
 * `isScheduling` guards against overlapping reschedules and is cleared in a `finally`. A process
 * death between the two — an OS kill, or a crash inside scheduling — never reaches that `finally`,
 * and the lock is persisted with the rest of the store, so it returns as `true`. While it is set,
 * `rescheduleIfNeeded` returns early and the foreground reschedule stops running. A cold launch
 * schedules directly and clears it either way, so the reset is what covers the launches in between.
 */
export const clearTransientSchedulingState = <T extends TransientSchedulingState>(state: T): T => {
  state.isScheduling = false;
  return state;
};

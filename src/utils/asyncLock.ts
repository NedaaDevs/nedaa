// Tiny async mutex built on a promise chain. Each call appends to the tail so
// concurrent invocations run strictly one-after-another instead of overlapping.
// The chain swallows rejections so a thrown body can never wedge the lock.
//
// Used to serialize SQLite write paths that would otherwise race on the shared
// connection — see initializeDailyItems in src/services/athkar-db.ts.
export const createAsyncLock = () => {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run;
  };
};

export type AsyncLock = ReturnType<typeof createAsyncLock>;

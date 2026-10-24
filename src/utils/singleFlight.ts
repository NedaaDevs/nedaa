const ignore = () => {};

/** Never overlaps runs; every call made mid-run shares one follow-up run. */
export const singleFlight = <T>(run: () => Promise<T>): (() => Promise<T>) => {
  let current: Promise<T> | null = null;
  let next: Promise<T> | null = null;

  const start = (): Promise<T> => {
    const started = run().finally(() => {
      if (current === started) current = null;
    });
    current = started;
    return started;
  };

  return () => {
    // A queued follow-up outlives `current` by a few ticks; join it, never race it.
    if (next) return next;
    if (!current) return start();

    // A failed run still starts the follow-up; its own caller sees the throw.
    next = current.then(ignore, ignore).then(() => {
      next = null;
      return start();
    });
    return next;
  };
};

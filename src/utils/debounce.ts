type QueueOptions = {
  /** A failed update stays queued for the next flush. */
  retainFailed?: boolean;
};

export const createDebouncedQueue = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 300,
  { retainFailed = false }: QueueOptions = {}
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdates: Map<string, Parameters<T>> = new Map();
  let lastFlush: Promise<void> = Promise.resolve();

  const drain = async () => {
    const updates = Array.from(pendingUpdates.entries());
    pendingUpdates.clear();

    // Execute updates sequentially to avoid locks
    for (const [key, args] of updates) {
      try {
        await fn(...args);
      } catch (error) {
        console.error(`Error processing update for ${key}:`, error);
        // A newer update for the key replaces the failed one.
        if (retainFailed && !pendingUpdates.has(key)) pendingUpdates.set(key, args);
      }
    }
  };

  // A flush starts when the one before it ends, so it resolves with every earlier update tried.
  const flush = () => {
    lastFlush = lastFlush.then(drain);
    return lastFlush;
  };

  return {
    add: (key: string, ...args: Parameters<T>) => {
      pendingUpdates.set(key, args);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(flush, delay);
    },

    flush,

    hasPending: () => pendingUpdates.size > 0,

    /** The queued updates' arguments. */
    pending: () => Array.from(pendingUpdates.values()),

    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingUpdates.clear();
    },
  };
};

export const createDebouncedQueue = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 300
) => {
  let timeoutId: number | null = null;
  let pendingUpdates: Map<string, Parameters<T>> = new Map();

  const flush = async () => {
    if (pendingUpdates.size === 0) return;

    // Process all pending updates
    const updates = Array.from(pendingUpdates.entries());
    pendingUpdates.clear();

    // Execute updates sequentially to avoid locks
    for (const [key, args] of updates) {
      try {
        await fn(...args);
      } catch (error) {
        console.error(`Error processing update for ${key}:`, error);
      }
    }
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

    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingUpdates.clear();
    },
  };
};

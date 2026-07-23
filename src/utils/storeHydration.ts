// Zustand persist middleware exposes async rehydration state on `store.persist`.
// Startup code that reads a persisted store synchronously can observe defaults
// before rehydration lands; `waitForHydration` gates that read on completion.

interface HydratablePersist {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
}

interface WaitForHydrationOptions {
  // Fail-safe cap so a stalled rehydration can never block a caller forever;
  // on expiry the promise resolves anyway and onTimeout fires.
  timeoutMs?: number;
  onTimeout?: () => void;
}

export const waitForHydration = (
  persist: HydratablePersist,
  options: WaitForHydrationOptions = {}
): Promise<void> => {
  if (persist.hasHydrated()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      if (timedOut) options.onTimeout?.();
      resolve();
    };

    unsubscribe = persist.onFinishHydration(() => finish(false));

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => finish(true), options.timeoutMs);
    }
  });
};

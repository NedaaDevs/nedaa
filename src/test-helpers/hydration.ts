/** A zustand store with the persist middleware's load-state API. */
type Persisted<S> = {
  getState: () => S;
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: (state: S) => void) => () => void;
  };
};

/** Holds the store's disk read open until `land` or `restore`. */
export const holdHydration = <S>(store: Persisted<S>) => {
  let landed = false;
  const listeners = new Set<(state: S) => void>();
  const finish = () => listeners.forEach((listener) => listener(store.getState()));
  const hasHydrated = jest.spyOn(store.persist, "hasHydrated").mockImplementation(() => landed);
  const onFinish = jest.spyOn(store.persist, "onFinishHydration").mockImplementation((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  return {
    land: () => {
      landed = true;
      finish();
    },
    /** Drops the hold: the store reads as loaded, and its waiters hear so. */
    restore: () => {
      hasHydrated.mockRestore();
      onFinish.mockRestore();
      finish();
    },
  };
};

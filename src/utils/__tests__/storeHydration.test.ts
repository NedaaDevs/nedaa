import { waitForHydration } from "@/utils/storeHydration";

const makeFakePersist = (hydrated: boolean) => {
  let listener: (() => void) | null = null;
  const unsubscribe = jest.fn(() => {
    listener = null;
  });
  return {
    hasHydrated: jest.fn(() => hydrated),
    onFinishHydration: jest.fn((fn: () => void) => {
      listener = fn;
      return unsubscribe;
    }),
    fireHydration: () => listener?.(),
    unsubscribe,
  };
};

describe("waitForHydration", () => {
  test("resolves immediately when already hydrated, without subscribing", async () => {
    const persist = makeFakePersist(true);

    await expect(waitForHydration(persist)).resolves.toBeUndefined();
    expect(persist.onFinishHydration).not.toHaveBeenCalled();
    expect(persist.unsubscribe).not.toHaveBeenCalled();
  });

  test("resolves once onFinishHydration fires when not yet hydrated", async () => {
    const persist = makeFakePersist(false);

    let resolved = false;
    const pending = waitForHydration(persist).then(() => {
      resolved = true;
    });

    expect(persist.onFinishHydration).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);

    persist.fireHydration();
    await pending;
    expect(resolved).toBe(true);
  });

  test("unsubscribes after the hydration callback resolves it", async () => {
    const persist = makeFakePersist(false);

    const pending = waitForHydration(persist);
    persist.fireHydration();
    await pending;

    expect(persist.unsubscribe).toHaveBeenCalledTimes(1);
  });

  describe("timeout fail-safe", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("resolves and calls onTimeout when hydration never finishes", async () => {
      const persist = makeFakePersist(false);
      const onTimeout = jest.fn();

      let resolved = false;
      const pending = waitForHydration(persist, { timeoutMs: 5000, onTimeout }).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      jest.advanceTimersByTime(5000);
      await pending;

      expect(resolved).toBe(true);
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(persist.unsubscribe).toHaveBeenCalledTimes(1);
    });

    test("does not fire onTimeout when hydration wins the race", async () => {
      const persist = makeFakePersist(false);
      const onTimeout = jest.fn();

      const pending = waitForHydration(persist, { timeoutMs: 5000, onTimeout });
      persist.fireHydration();
      await pending;

      jest.advanceTimersByTime(5000);
      expect(onTimeout).not.toHaveBeenCalled();
      expect(persist.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

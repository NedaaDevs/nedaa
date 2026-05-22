import { createAsyncLock } from "@/utils/asyncLock";

// Hand-resolved deferred — lets a test pause a "transaction" mid-flight and
// observe whether a concurrent caller is allowed to enter at the same time.
const defer = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("createAsyncLock", () => {
  test("serializes overlapping calls — second body waits for first to settle", async () => {
    const lock = createAsyncLock();

    // Track concurrency: increment on entry, decrement on exit. If the lock
    // works, peak must never exceed 1, and bodies must enter in order.
    let inFlight = 0;
    let peak = 0;
    const enters: number[] = [];

    const d1 = defer<void>();
    const d2 = defer<void>();

    const flush = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    const p1 = lock(async () => {
      enters.push(1);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await d1.promise;
      inFlight--;
      return "first";
    });

    const p2 = lock(async () => {
      enters.push(2);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await d2.promise;
      inFlight--;
      return "second";
    });

    // After enqueue + microtask flush: p1 has entered, p2 must not have.
    await flush();
    expect(enters).toEqual([1]);
    expect(inFlight).toBe(1);

    // Release p1; after flush p2 should now be in-flight, sitting on d2.
    d1.resolve();
    await p1;
    await flush();
    expect(enters).toEqual([1, 2]);
    expect(inFlight).toBe(1);
    expect(peak).toBe(1);

    // Drain p2.
    d2.resolve();
    await p2;
    expect(inFlight).toBe(0);
    expect(peak).toBe(1);
  });

  test("preserves enqueue order", async () => {
    const lock = createAsyncLock();
    const order: number[] = [];

    const tasks = [1, 2, 3, 4, 5].map((n) =>
      lock(async () => {
        order.push(n);
      })
    );

    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  test("a rejecting body does not wedge the chain — next caller still runs", async () => {
    const lock = createAsyncLock();

    const failing = lock(async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");

    const ok = await lock(async () => "ok");
    expect(ok).toBe("ok");
  });

  test("a rejecting body still releases the lock for the next caller", async () => {
    const lock = createAsyncLock();

    let secondStarted = false;
    const failing = lock(async () => {
      throw new Error("boom");
    });
    const second = lock(async () => {
      secondStarted = true;
      return "second";
    });

    await expect(failing).rejects.toThrow("boom");
    await expect(second).resolves.toBe("second");
    expect(secondStarted).toBe(true);
  });

  test("returns the body's resolved value to the caller", async () => {
    const lock = createAsyncLock();
    await expect(lock(async () => 42)).resolves.toBe(42);
    await expect(lock(async () => ({ ok: true }))).resolves.toEqual({ ok: true });
  });
});

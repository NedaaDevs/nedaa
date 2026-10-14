import { later, never, outcomeOf } from "@/test-helpers/promises";
import { withDeadline, withTimeout } from "@/utils/withTimeout";

const LIMIT_MS = 1000;
const REASON = "no answer in time";

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves to the fallback once the time passes, and reports the timeout once", async () => {
    const onTimeout = jest.fn();
    const settled = jest.fn();
    void withTimeout(never<boolean>(), LIMIT_MS, false, onTimeout).then(settled);

    await jest.advanceTimersByTimeAsync(LIMIT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(false);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(LIMIT_MS * 5);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("still resolves to the fallback when onTimeout throws", async () => {
    const settled = jest.fn();
    void withTimeout(never<boolean>(), LIMIT_MS, false, () => {
      throw new Error("logger failed");
    }).then(settled);

    await expect(jest.advanceTimersByTimeAsync(LIMIT_MS)).rejects.toThrow("logger failed");
    await jest.advanceTimersByTimeAsync(0);

    expect(settled).toHaveBeenCalledWith(false);
  });

  it("uses a value that answers in time and clears its timer", async () => {
    const onTimeout = jest.fn();

    await expect(withTimeout(Promise.resolve(true), LIMIT_MS, false, onTimeout)).resolves.toBe(
      true
    );

    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(LIMIT_MS);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("resolves to the fallback when the work fails, and never rejects", async () => {
    const onTimeout = jest.fn();

    await expect(
      withTimeout(Promise.reject(new Error("read failed")), LIMIT_MS, false, onTimeout)
    ).resolves.toBe(false);

    expect(jest.getTimerCount()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("keeps the fallback when the work answers after the time", async () => {
    const late = later<boolean>();
    const result = withTimeout(late.promise, LIMIT_MS, false);

    await jest.advanceTimersByTimeAsync(LIMIT_MS);
    late.release(true);

    await expect(result).resolves.toBe(false);
  });
});

describe("withDeadline", () => {
  it("rejects with the reason once the time passes, and inTime then reads false", async () => {
    let inTime = () => true;
    const outcome = outcomeOf(
      withDeadline(
        (check) => {
          inTime = check;
          return never<boolean>();
        },
        LIMIT_MS,
        REASON
      )
    );

    await jest.advanceTimersByTimeAsync(LIMIT_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    expect(inTime()).toBe(true);

    await jest.advanceTimersByTimeAsync(1);
    expect(outcome).toHaveBeenCalledWith({ error: expect.objectContaining({ message: REASON }) });
    expect(inTime()).toBe(false);
  });

  it("uses a value that answers in time, keeps inTime true and clears its timer", async () => {
    let inTime = () => false;
    const result = withDeadline(
      (check) => {
        inTime = check;
        return Promise.resolve(true);
      },
      LIMIT_MS,
      REASON
    );

    await expect(result).resolves.toBe(true);
    expect(inTime()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("passes the work's own failure through and clears its timer", async () => {
    const result = withDeadline(() => Promise.reject(new Error("fix failed")), LIMIT_MS, REASON);

    await expect(result).rejects.toThrow("fix failed");
    expect(jest.getTimerCount()).toBe(0);
  });
});

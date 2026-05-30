import { createSerializedDatabase } from "@/utils/serializedDatabase";

// Minimal fake that satisfies the parts of SQLiteDatabase the wrapper touches.
const makeFakeDb = () => ({ closeAsync: jest.fn(async () => {}) });

describe("createSerializedDatabase", () => {
  it("serializes concurrent run() calls (peak depth = 1)", async () => {
    const sdb = createSerializedDatabase(async () => makeFakeDb() as any);
    let inFlight = 0;
    let peak = 0;
    const op = () =>
      sdb.run(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
      });
    await Promise.all([op(), op(), op(), op(), op()]);
    expect(peak).toBe(1);
  });

  it("releases the lock when an operation throws", async () => {
    const sdb = createSerializedDatabase(async () => makeFakeDb() as any);
    await expect(
      sdb.run(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    const result = await sdb.run(async () => "ok");
    expect(result).toBe("ok");
  });

  it("opens the connection exactly once across many runs", async () => {
    const open = jest.fn(async () => makeFakeDb() as any);
    const sdb = createSerializedDatabase(open);
    await Promise.all([sdb.run(async () => {}), sdb.run(async () => {}), sdb.run(async () => {})]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("retries open after a failed open", async () => {
    const open = jest
      .fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValue(makeFakeDb() as any);
    const sdb = createSerializedDatabase(open);
    await expect(sdb.run(async () => "x")).rejects.toThrow("open failed");
    await expect(sdb.run(async () => "y")).resolves.toBe("y");
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("close() closes the connection and a later run() reopens", async () => {
    const db = makeFakeDb();
    const open = jest.fn(async () => db as any);
    const sdb = createSerializedDatabase(open);
    await sdb.run(async () => {});
    await sdb.close();
    expect(db.closeAsync).toHaveBeenCalledTimes(1);
    await sdb.run(async () => {});
    expect(open).toHaveBeenCalledTimes(2);
  });
});

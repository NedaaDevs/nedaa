import { createSerializedDatabase } from "@/utils/serializedDatabase";

// Fake driver faithful to expo-sqlite's single-connection rule: a second BEGIN
// while a transaction is open throws "cannot start a transaction within a
// transaction" (the exact production error), and it tracks peak concurrent
// operation depth so we can detect interleaving.
const makeTrackingDb = () => {
  let txOpen = false;
  let inFlight = 0;
  const stats = { peakInFlight: 0, nestedBeginErrors: 0 };
  const tick = async () => {
    inFlight += 1;
    stats.peakInFlight = Math.max(stats.peakInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 3));
    inFlight -= 1;
  };
  const db = {
    runAsync: async () => {
      await tick();
      return { changes: 1, lastInsertRowId: 1 };
    },
    getFirstAsync: async () => {
      await tick();
      return null;
    },
    getAllAsync: async () => {
      await tick();
      return [];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      if (txOpen) {
        stats.nestedBeginErrors += 1;
        throw new Error("cannot start a transaction within a transaction");
      }
      txOpen = true;
      try {
        await task();
      } finally {
        txOpen = false;
      }
    },
    closeAsync: async () => {},
  };
  return { db: db as any, stats };
};

describe("serialized athkar DB access", () => {
  it("a concurrent burst never interleaves on the connection", async () => {
    const { db, stats } = makeTrackingDb();
    const sdb = createSerializedDatabase(async () => db);

    // Stand-ins for the store's debounced queues firing together:
    // updateAthkarCount (plain), checkAndMarkSessionComplete (read + write),
    // and a transaction-bearing op (daily-init).
    const count = () => sdb.run((d) => d.runAsync());
    const check = () =>
      sdb.run(async (d) => {
        await d.getAllAsync();
        await d.runAsync();
      });
    const txn = () =>
      sdb.run((d) =>
        d.withTransactionAsync(async () => {
          await d.runAsync();
        })
      );

    await Promise.all([count(), check(), txn(), count(), check(), txn(), count(), check()]);

    expect(stats.peakInFlight).toBe(1);
    expect(stats.nestedBeginErrors).toBe(0);
  });

  it("control: the same burst WITHOUT the lock reproduces the production bug", async () => {
    // Drives the ops directly on the connection (no serialization) to prove the
    // fixture is faithful — this is what the unfixed code did.
    const { db, stats } = makeTrackingDb();

    const count = () => db.runAsync();
    const check = async () => {
      await db.getAllAsync();
      await db.runAsync();
    };
    const txn = () =>
      db.withTransactionAsync(async () => {
        await db.runAsync();
      });

    await Promise.all(
      [count(), check(), txn(), count(), check(), txn(), count(), check()].map((p) =>
        Promise.resolve(p).catch(() => {})
      )
    );

    // Without serialization the ops interleave and a nested BEGIN is hit.
    expect(stats.peakInFlight).toBeGreaterThan(1);
    expect(stats.nestedBeginErrors).toBeGreaterThan(0);
  });
});

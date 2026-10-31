const mockPrayer = jest.fn(async () => {});
const mockQada = jest.fn(async () => {});
jest.mock("@/services/db", () => ({ PrayerTimesDB: { initialize: () => mockPrayer() } }));
jest.mock("@/services/qada-db", () => ({ QadaDB: { initialize: () => mockQada() } }));

const loadInitDatabases = () => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fresh: typeof import("@/services/databases") = require("@/services/databases");
  return fresh.initDatabases;
};

describe("initDatabases", () => {
  beforeEach(() => {
    mockPrayer.mockReset().mockImplementation(async () => {});
    mockQada.mockReset().mockImplementation(async () => {});
  });

  it("opens each database once however often it is called", async () => {
    const initDatabases = loadInitDatabases();
    await Promise.all([initDatabases(), initDatabases()]);
    await initDatabases();
    expect(mockPrayer).toHaveBeenCalledTimes(1);
    expect(mockQada).toHaveBeenCalledTimes(1);
  });

  it("retries the open after a failed attempt", async () => {
    mockPrayer.mockRejectedValueOnce(new Error("disk busy"));
    const initDatabases = loadInitDatabases();
    await expect(initDatabases()).rejects.toThrow("disk busy");
    await expect(initDatabases()).resolves.toBeUndefined();
    expect(mockPrayer).toHaveBeenCalledTimes(2);
    expect(mockQada).toHaveBeenCalledTimes(1);
  });
});

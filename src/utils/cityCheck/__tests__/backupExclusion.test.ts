import { CITY_CHECK_STORAGE_DB_NAME } from "@/constants/DB";
import { excludeCityCheckFromBackup } from "@/utils/cityCheck/backupExclusion";

const DATABASE_DIRECTORY = "/container/Documents/SQLite";

const mockExclude = jest.fn();
const mockWarn = jest.fn();

jest.mock("expo-sqlite", () => ({ defaultDatabaseDirectory: "/container/Documents/SQLite" }));
jest.mock("../../../../modules/expo-diagnostics/src", () => ({
  ExpoDiagnosticsModule: { excludeFromBackup: (path: string) => mockExclude(path) },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ w: (...args: unknown[]) => mockWarn(...args) }) },
}));

beforeEach(() => jest.clearAllMocks());

describe("excludeCityCheckFromBackup", () => {
  it("flags the file expo-sqlite keeps the memory in", async () => {
    mockExclude.mockResolvedValue(undefined);

    await excludeCityCheckFromBackup();

    expect(mockExclude).toHaveBeenCalledWith(`${DATABASE_DIRECTORY}/${CITY_CHECK_STORAGE_DB_NAME}`);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("logs a failure without the path and without throwing", async () => {
    mockExclude.mockRejectedValue(new Error(`no file at ${DATABASE_DIRECTORY}`));

    await expect(excludeCityCheckFromBackup()).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain(DATABASE_DIRECTORY);
  });
});

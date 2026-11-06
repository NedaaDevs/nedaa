// Assigned inside the factory: jest.mock is hoisted above the imports, so a const declared
// here would still be in its temporal dead zone when the binding captures the native module.
// eslint-disable-next-line no-var
var mockExclude: jest.Mock;

jest.mock("expo-modules-core", () => {
  mockExclude = jest.fn(() => Promise.resolve());
  return {
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => ({
      excludeFromBackup: (path: string) => mockExclude(path),
    }),
  };
});

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { ExpoDiagnosticsModule } from "../index";

describe("excludeFromBackup", () => {
  it("passes the path to the native binding", async () => {
    await ExpoDiagnosticsModule.excludeFromBackup("/a/file");

    expect(mockExclude).toHaveBeenCalledWith("/a/file");
  });

  it("passes a native failure to the caller", async () => {
    mockExclude.mockRejectedValueOnce(new Error("no file"));

    await expect(ExpoDiagnosticsModule.excludeFromBackup("/a/file")).rejects.toThrow("no file");
  });
});

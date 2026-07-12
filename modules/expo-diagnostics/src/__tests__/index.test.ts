jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => null,
}));

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { ExpoDiagnosticsModule } from "../index";

describe("ExpoDiagnosticsModule (native absent)", () => {
  it("reports unavailable when native module is missing", () => {
    expect(ExpoDiagnosticsModule.isAvailable).toBe(false);
  });

  it("drain resolves to empty array when native module is missing", async () => {
    await expect(ExpoDiagnosticsModule.drain()).resolves.toEqual([]);
  });
});

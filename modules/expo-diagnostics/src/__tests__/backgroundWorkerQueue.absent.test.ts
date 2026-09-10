jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => ({ drain: jest.fn() }),
}));

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { ExpoDiagnosticsModule } from "../index";

describe("readBackgroundWorkerQueue on a platform without WorkManager", () => {
  // iOS loads the module but exposes no queue binding. Reporting "unsupported" is what keeps
  // a platform that cannot measure from rendering as a queue that is empty.
  it("reports unsupported rather than a zero count", async () => {
    await expect(ExpoDiagnosticsModule.readBackgroundWorkerQueue()).resolves.toEqual({
      status: "unsupported",
    });
  });
});

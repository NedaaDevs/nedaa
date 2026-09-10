// Assigned inside the factory: jest.mock is hoisted above the imports, so a const declared
// here would still be in its temporal dead zone when the binding captures the native module.
// eslint-disable-next-line no-var
var mockRead: jest.Mock;

jest.mock("expo-modules-core", () => {
  mockRead = jest.fn();
  return {
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => ({
      readBackgroundWorkerQueue: () => mockRead(),
    }),
  };
});

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { ExpoDiagnosticsModule } from "../index";

const counts = {
  uniqueName: "EXPO_BACKGROUND_WORKER",
  total: 31,
  unfinished: 29,
  enqueued: 1,
  running: 1,
  blocked: 27,
  succeeded: 2,
  failed: 0,
  cancelled: 0,
  maxRunAttemptCount: 3,
};

describe("readBackgroundWorkerQueue", () => {
  beforeEach(() => mockRead.mockReset());

  it("returns the native counts", async () => {
    mockRead.mockResolvedValue(counts);

    await expect(ExpoDiagnosticsModule.readBackgroundWorkerQueue()).resolves.toEqual({
      status: "ok",
      counts,
    });
  });

  it("reports an error instead of throwing into the caller", async () => {
    mockRead.mockRejectedValue(new Error("WorkManager unavailable"));

    await expect(ExpoDiagnosticsModule.readBackgroundWorkerQueue()).resolves.toEqual({
      status: "error",
      message: "WorkManager unavailable",
    });
  });

  it("keeps a zero queue distinguishable from a queue it could not read", async () => {
    mockRead.mockResolvedValue({ ...counts, total: 0, unfinished: 0, blocked: 0 });

    const result = await ExpoDiagnosticsModule.readBackgroundWorkerQueue();

    expect(result.status).toBe("ok");
    expect(result).not.toEqual({ status: "unsupported" });
  });
});

const mockDrain = jest.fn();
const mockError = jest.fn();
const mockWarn = jest.fn();
const mockSentinel = jest.fn();

jest.mock("../../../modules/expo-diagnostics/src", () => ({
  ExpoDiagnosticsModule: { drain: () => mockDrain() },
  NativeDiagnosticKind: {
    CRASH: "crash",
    ANR: "anr",
    HANG: "hang",
    MEMORY: "memory",
    OTHER: "other",
  },
}));

// Lazy wrappers: `nativeDiagnostics` captures `log`/`writeNativePendingReport` at module-load,
// which runs (via import hoisting) before the mock fns above are assigned. Delegating keeps the
// binding to the real jest.fn resolved at call-time.
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({
      e: (...args: unknown[]) => mockError(...args),
      w: (...args: unknown[]) => mockWarn(...args),
    }),
  },
}));

jest.mock("@/utils/crashHandler", () => ({
  writeNativePendingReport: (...args: unknown[]) => mockSentinel(...args),
}));

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { processNativeDiagnostics } from "@/utils/nativeDiagnostics";

describe("processNativeDiagnostics", () => {
  beforeEach(() => {
    mockDrain.mockReset();
    mockError.mockReset();
    mockWarn.mockReset();
    mockSentinel.mockReset();
  });

  it("logs crash/anr at error and hang/memory at warn", async () => {
    mockDrain.mockResolvedValue([
      { id: "1", kind: "crash", timestamp: 1, summary: "boom", detail: "stack" },
      { id: "2", kind: "hang", timestamp: 2, summary: "slow" },
      { id: "3", kind: "memory", timestamp: 3, summary: "oom" },
    ]);
    await processNativeDiagnostics();
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });

  it("writes a sentinel once when any crash/anr is present", async () => {
    mockDrain.mockResolvedValue([
      { id: "1", kind: "anr", timestamp: 1, summary: "ANR main" },
      { id: "2", kind: "crash", timestamp: 2, summary: "SIGABRT" },
    ]);
    await processNativeDiagnostics();
    expect(mockSentinel).toHaveBeenCalledTimes(1);
  });

  it("does not write a sentinel for hang/memory only", async () => {
    mockDrain.mockResolvedValue([{ id: "1", kind: "hang", timestamp: 1, summary: "slow" }]);
    await processNativeDiagnostics();
    expect(mockSentinel).not.toHaveBeenCalled();
  });

  it("never throws when drain rejects", async () => {
    mockDrain.mockRejectedValue(new Error("native boom"));
    await expect(processNativeDiagnostics()).resolves.toBeUndefined();
    expect(mockSentinel).not.toHaveBeenCalled();
  });

  it("does nothing on an empty drain", async () => {
    mockDrain.mockResolvedValue([]);
    await processNativeDiagnostics();
    expect(mockError).not.toHaveBeenCalled();
    expect(mockSentinel).not.toHaveBeenCalled();
  });
});

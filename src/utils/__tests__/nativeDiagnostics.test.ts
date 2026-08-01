const mockDrain = jest.fn();
const mockAck = jest.fn();
const mockError = jest.fn();
const mockWarn = jest.fn();
const mockSentinel = jest.fn();
const mockFlush = jest.fn();

jest.mock("../../../modules/expo-diagnostics/src", () => ({
  ExpoDiagnosticsModule: {
    drain: () => mockDrain(),
    ack: (tokens: string[]) => mockAck(tokens),
  },
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
    flushAllSync: (...args: unknown[]) => mockFlush(...args),
  },
}));

jest.mock("@/utils/crashHandler", () => ({
  writeNativePendingReport: (...args: unknown[]) => mockSentinel(...args),
}));

// The module holds a once-per-session drain guard, so every test needs a fresh instance.
const freshProcess = (): (() => Promise<void>) => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/utils/nativeDiagnostics").processNativeDiagnostics;
};

describe("processNativeDiagnostics", () => {
  beforeEach(() => {
    mockDrain.mockReset();
    mockAck.mockReset();
    mockError.mockReset();
    mockWarn.mockReset();
    mockSentinel.mockReset();
    mockFlush.mockReset();
  });

  it("logs crash/anr at error and hang/memory at warn", async () => {
    mockDrain.mockResolvedValue([
      { id: "1", kind: "crash", timestamp: 1, summary: "boom", detail: "stack" },
      { id: "2", kind: "hang", timestamp: 2, summary: "slow" },
      { id: "3", kind: "memory", timestamp: 3, summary: "oom" },
    ]);
    await freshProcess()();
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });

  it("prefixes log lines with the entry's own event time", async () => {
    mockDrain.mockResolvedValue([
      { id: "1", kind: "crash", timestamp: Date.UTC(2026, 7, 1, 15, 41, 54), summary: "boom" },
    ]);
    await freshProcess()();
    expect(mockError).toHaveBeenCalledWith(
      "native-crash",
      expect.stringContaining("[at 2026-08-01T15:41:54.000Z]")
    );
  });

  it("writes a sentinel once when any crash/anr is present", async () => {
    mockDrain.mockResolvedValue([
      { id: "1", kind: "anr", timestamp: 1, summary: "ANR main" },
      { id: "2", kind: "crash", timestamp: 2, summary: "SIGABRT" },
    ]);
    await freshProcess()();
    expect(mockSentinel).toHaveBeenCalledTimes(1);
  });

  it("does not write a sentinel for hang/memory only", async () => {
    mockDrain.mockResolvedValue([{ id: "1", kind: "hang", timestamp: 1, summary: "slow" }]);
    await freshProcess()();
    expect(mockSentinel).not.toHaveBeenCalled();
  });

  it("flushes logs to disk before acking the drained tokens", async () => {
    const order: string[] = [];
    mockFlush.mockImplementation(() => order.push("flush"));
    mockAck.mockImplementation(() => order.push("ack"));
    mockDrain.mockResolvedValue([
      { id: "1", kind: "crash", timestamp: 1, summary: "boom", ackToken: "100" },
      { id: "2", kind: "memory", timestamp: 2, summary: "oom", ackToken: "200" },
    ]);
    await freshProcess()();
    expect(order).toEqual(["flush", "ack"]);
    expect(mockAck).toHaveBeenCalledWith(["100", "200"]);
  });

  it("skips ack when entries carry no tokens (older native binary)", async () => {
    mockDrain.mockResolvedValue([{ id: "1", kind: "crash", timestamp: 1, summary: "boom" }]);
    await freshProcess()();
    expect(mockAck).not.toHaveBeenCalled();
  });

  it("drains only once per module instance", async () => {
    mockDrain.mockResolvedValue([]);
    const process = freshProcess();
    await process();
    await process();
    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it("never throws when drain rejects", async () => {
    mockDrain.mockRejectedValue(new Error("native boom"));
    await expect(freshProcess()()).resolves.toBeUndefined();
    expect(mockSentinel).not.toHaveBeenCalled();
  });

  it("does nothing on an empty drain", async () => {
    mockDrain.mockResolvedValue([]);
    await freshProcess()();
    expect(mockError).not.toHaveBeenCalled();
    expect(mockSentinel).not.toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
  });
});

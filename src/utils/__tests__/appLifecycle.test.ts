const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockPending = jest.fn();
const mockFlush = jest.fn();

let mockCurrentState = "active";
let mockPlatformOS = "ios";
let mockListener: ((next: string) => void) | null = null;

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
    select: (choices: Record<string, unknown>) => choices.ios ?? choices.default,
  },
  AppState: {
    get currentState() {
      return mockCurrentState;
    },
    addEventListener: (_: string, cb: (next: string) => void) => {
      mockListener = cb;
      return { remove: jest.fn() };
    },
  },
}));

// In-memory stand-in for the session-state file. `mockWritten` is the JSON the module last
// persisted; `mockStored` is what a previous session left behind for it to read.
let mockStored: string | null = null;
let mockWritten: string | null = null;

jest.mock("expo-file-system", () => ({
  Paths: { document: "/doc" },
  Directory: class {
    exists = true;
    create() {}
  },
  File: class {
    get exists() {
      return mockStored !== null;
    }
    create() {
      mockStored = "";
    }
    textSync() {
      return mockStored ?? "";
    }
    write(contents: string) {
      mockWritten = contents;
      mockStored = contents;
    }
  },
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "2.10.0",
  nativeBuildVersion: "515",
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({
      i: (...args: unknown[]) => mockInfo(...args),
      w: (...args: unknown[]) => mockWarn(...args),
    }),
    flushAllSync: (...args: unknown[]) => mockFlush(...args),
  },
}));

jest.mock("@/utils/crashHandler", () => ({
  readPendingReport: () => mockPending(),
}));

// The module holds a once-per-process install guard, so every test needs a fresh instance.
const freshInstall = (): (() => void) => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/utils/appLifecycle").installLifecycleLogging;
};

const sessionState = () => (mockWritten === null ? null : JSON.parse(mockWritten));

describe("installLifecycleLogging", () => {
  beforeEach(() => {
    mockInfo.mockReset();
    mockWarn.mockReset();
    mockPending.mockReset();
    mockFlush.mockReset();
    mockPending.mockReturnValue(null);
    mockCurrentState = "active";
    mockPlatformOS = "ios";
    mockListener = null;
    mockStored = null;
    mockWritten = null;
  });

  it("records the launch as background when the OS launched the app into the background", () => {
    mockCurrentState = "background";

    freshInstall()();

    expect(sessionState()).toEqual({ state: "background", version: "2.10.0 (515)" });
  });

  // Android's AppStateModule seeds its initial constant to `background` unless the host is
  // already RESUMED, so the value is untrustworthy at launch there.
  it("records an Android launch as active even when the initial state constant says background", () => {
    mockPlatformOS = "android";
    mockCurrentState = "background";

    freshInstall()();

    expect(sessionState()).toEqual({ state: "active", version: "2.10.0 (515)" });
  });

  it("records a foreground launch as active", () => {
    mockCurrentState = "active";
    mockPlatformOS = "ios";

    freshInstall()();

    expect(sessionState()).toEqual({ state: "active", version: "2.10.0 (515)" });
  });

  it("raises no unclean-exit warning when the previous session ended in the background", () => {
    mockStored = JSON.stringify({ state: "background", version: "2.10.0 (515)" });

    freshInstall()();

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("warns when the previous foreground session died with no crash sentinel", () => {
    mockStored = JSON.stringify({ state: "active", version: "2.9.9 (503)" });

    freshInstall()();

    expect(mockWarn).toHaveBeenCalledWith("Session", expect.stringContaining("2.9.9 (503)"));
  });

  it("keeps recording state changes after launch", () => {
    freshInstall()();

    mockListener?.("background");

    expect(sessionState()).toEqual({ state: "background", version: "2.10.0 (515)" });
    expect(mockFlush).toHaveBeenCalled();
  });
});

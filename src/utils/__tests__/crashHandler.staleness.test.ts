// In-memory expo-file-system so the sentinel write/read round-trips deterministically.
jest.mock("expo-file-system", () => {
  let content: string | null = null;
  class File {
    get exists() {
      return content !== null;
    }
    create() {
      content = content ?? "";
    }
    write(data: string) {
      content = data;
    }
    textSync() {
      return content ?? "";
    }
    delete() {
      content = null;
    }
  }
  class Directory {}
  return { File, Directory, Paths: { document: "/doc" } };
});

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ e: jest.fn(), w: jest.fn() }), flushAllSync: jest.fn() },
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "2.10.0",
  nativeBuildVersion: "515",
}));

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import {
  writeNativePendingReport,
  readPendingReport,
  clearPendingReport,
  isPendingReportActionable,
  type PendingReport,
} from "@/utils/crashHandler";

const DAY_MS = 24 * 60 * 60 * 1000;

const sentinel = (over: Partial<PendingReport> = {}): PendingReport => ({
  ts: Date.now(),
  kind: "native-crash",
  summary: "crash exc=10/0 sig=9  v2.10.0",
  version: "2.10.0 (515)",
  ...over,
});

describe("sentinel build stamp", () => {
  beforeEach(() => clearPendingReport());

  it("stamps the build that died when the drain supplies one", () => {
    writeNativePendingReport("native-crash", "boom", "2.9.9 (503)");

    expect(readPendingReport()?.version).toBe("2.9.9 (503)");
  });

  it("stamps the running build on every sentinel it writes", () => {
    writeNativePendingReport("native-crash", "SIGABRT exc=1");

    expect(readPendingReport()?.version).toBe("2.10.0 (515)");
  });
});

describe("isPendingReportActionable", () => {
  it("accepts a fresh sentinel from the running build", () => {
    expect(isPendingReportActionable(sentinel())).toBe(true);
  });

  it("rejects a sentinel left by an earlier build", () => {
    expect(isPendingReportActionable(sentinel({ version: "2.9.8 (496)" }))).toBe(false);
  });

  it("rejects a sentinel written before the build was installed, even unversioned", () => {
    expect(isPendingReportActionable(sentinel({ version: undefined }))).toBe(false);
  });

  it("rejects a sentinel older than the reporting window", () => {
    expect(isPendingReportActionable(sentinel({ ts: Date.now() - 31 * DAY_MS }))).toBe(false);
  });

  it("accepts a sentinel still inside the reporting window", () => {
    expect(isPendingReportActionable(sentinel({ ts: Date.now() - 29 * DAY_MS }))).toBe(true);
  });
});

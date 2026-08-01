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

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import {
  installCrashHandler,
  writeNativePendingReport,
  readPendingReport,
  clearPendingReport,
} from "@/utils/crashHandler";

describe("writeNativePendingReport", () => {
  beforeEach(() => clearPendingReport());

  it("persists a native-crash sentinel that readPendingReport returns", () => {
    writeNativePendingReport("native-crash", "SIGABRT exc=1");
    const pending = readPendingReport();
    expect(pending?.kind).toBe("native-crash");
    expect(pending?.summary).toContain("SIGABRT");
  });

  it("persists an anr sentinel", () => {
    writeNativePendingReport("anr", "ANR in main");
    expect(readPendingReport()?.kind).toBe("anr");
  });
});

describe("installCrashHandler", () => {
  it("installs once, and writes the sentinel only for fatal errors", () => {
    const handlers: Array<(e: Error, isFatal?: boolean) => void> = [];
    const setSpy = jest
      .spyOn(ErrorUtils, "setGlobalHandler")
      .mockImplementation((h) => handlers.push(h as (e: Error, isFatal?: boolean) => void));
    jest.spyOn(ErrorUtils, "getGlobalHandler").mockReturnValue(undefined as never);

    installCrashHandler();
    installCrashHandler();
    expect(setSpy).toHaveBeenCalledTimes(1);

    clearPendingReport();
    // RN reports guarded, recoverable errors with isFatal=false — no crash sentinel.
    handlers[0](new Error("guarded"), false);
    expect(readPendingReport()).toBeNull();

    handlers[0](new Error("boom"), true);
    expect(readPendingReport()?.kind).toBe("crash");

    jest.restoreAllMocks();
  });
});

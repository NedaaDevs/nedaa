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

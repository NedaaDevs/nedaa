// In-memory expo-file-system: each file's size by its path.
const mockFs = { files: new Map<string, number>() };

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(directory: string, name: string) {
      this.uri = `${directory}/${name}`;
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    get size() {
      return mockFs.files.get(this.uri) ?? 0;
    }
    delete() {
      mockFs.files.delete(this.uri);
    }
    async move(destination: File) {
      mockFs.files.set(destination.uri, this.size);
      mockFs.files.delete(this.uri);
    }
  }
  class DownloadTask {
    file: File;
    constructor(_url: string, file: File) {
      this.file = file;
    }
    async downloadAsync() {
      mockFs.files.set(this.file.uri, 6_073_000);
      return { uri: this.file.uri };
    }
  }
  return { File, DownloadTask, Paths: { cache: "/cache", document: "/doc" } };
});

jest.mock("@/services/cities-db", () => ({ invalidateCitiesDb: jest.fn() }));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

// eslint-disable-next-line import/first -- imports follow the hoisted mocks
import { CITIES_DB_NAME } from "@/constants/DB";
// eslint-disable-next-line import/first
import { invalidateCitiesDb } from "@/services/cities-db";
// eslint-disable-next-line import/first
import { downloadCitiesPack } from "@/services/cities-download";

const installed = () => mockFs.files.has(`/doc/${CITIES_DB_NAME}`);
const download = () => downloadCitiesPack({ onProgress: jest.fn() });

beforeEach(() => {
  mockFs.files.clear();
  jest.mocked(invalidateCitiesDb).mockReset();
});

describe("downloadCitiesPack", () => {
  it("installs the pack once the open connection lets go", async () => {
    jest.mocked(invalidateCitiesDb).mockResolvedValue(true);

    await download();

    expect(installed()).toBe(true);
  });

  // The store reads a resolve as installed; a kept connection is a failure.
  it("fails, leaving the pack uninstalled, while the connection stays open", async () => {
    jest.mocked(invalidateCitiesDb).mockResolvedValue(false);

    await expect(download()).rejects.toThrow();

    expect(installed()).toBe(false);
  });
});

import { MushafVersion } from "@/enums/quran";

// A cancelled edition download leaves `bounds-<version>.db` absent. expo-sqlite opens
// with SQLITE_OPEN_CREATE, so an unguarded open manufactures an empty DB.

const mockExistingFiles = new Set<string>();
const mockOpenDatabaseAsync = jest.fn();
const mockGetAllAsync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
  defaultDatabaseDirectory: "/db",
}));

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `${dir}/${name}`;
    }
    get exists(): boolean {
      return mockExistingFiles.has(this.uri);
    }
  },
  Directory: class {
    exists = true;
    create(): void {}
  },
  Paths: { appleSharedContainers: {} },
  DownloadTask: class {},
}));

jest.mock("react-native-zip-archive", () => ({ unzip: jest.fn() }));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({
      d: jest.fn(),
      i: jest.fn(),
      w: jest.fn(),
      e: jest.fn(),
    }),
  },
}));

const BOUNDS_URI = "file:///db/bounds-v2.db";

// Unrelated stores open their own DBs on import; count only the bounds opens.
const boundsOpens = (): unknown[][] =>
  mockOpenDatabaseAsync.mock.calls.filter((call) => String(call[0]).startsWith("bounds-"));

// require, not import: each test needs a fresh module after jest.resetModules().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadDb = () => require("@/services/quran-content-db").QuranContentDB;

describe("bounds DB reads when the edition was never installed", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExistingFiles.clear();
    mockOpenDatabaseAsync.mockReset();
    mockGetAllAsync.mockReset();
    mockOpenDatabaseAsync.mockResolvedValue({ getAllAsync: mockGetAllAsync });
    mockGetAllAsync.mockResolvedValue([]);
  });

  test("never opens a database that would be created empty", async () => {
    await loadDb().getGlyphBounds(MushafVersion.V2, 1);

    expect(boundsOpens()).toEqual([]);
  });

  test.each([
    ["getGlyphBounds", (db: any) => db.getGlyphBounds(MushafVersion.V2, 1)],
    ["getMarkerBounds", (db: any) => db.getMarkerBounds(MushafVersion.V2, 1)],
    ["getLineMetadata", (db: any) => db.getLineMetadata(MushafVersion.V2, 1)],
    ["getAyahWordGlyphs", (db: any) => db.getAyahWordGlyphs(MushafVersion.V2, 2, 255)],
  ])("%s resolves empty instead of rejecting", async (_name, read) => {
    await expect(read(loadDb())).resolves.toEqual([]);
  });

  test("a read after the file arrives opens it, so a re-download repairs the reader", async () => {
    const db = loadDb();
    await db.getGlyphBounds(MushafVersion.V2, 1);
    expect(boundsOpens()).toEqual([]);

    mockExistingFiles.add(BOUNDS_URI);
    mockGetAllAsync.mockResolvedValue([
      {
        page: 1,
        line: 2,
        position: 3,
        surah_number: 1,
        ayah_number: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        is_marker: 0,
        word_index: 1,
      },
    ]);

    // A different page — the first read's cache key is not under test.
    const bounds = await db.getGlyphBounds(MushafVersion.V2, 2);

    expect(boundsOpens()).toHaveLength(1);
    expect(bounds).toHaveLength(1);
  });
});

describe("bounds DB reads when the file exists but carries no tables", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExistingFiles.clear();
    mockExistingFiles.add(BOUNDS_URI);
    mockOpenDatabaseAsync.mockReset();
    mockGetAllAsync.mockReset();
    mockOpenDatabaseAsync.mockResolvedValue({ getAllAsync: mockGetAllAsync });
    mockGetAllAsync.mockRejectedValue(new Error("no such table: glyph_bounds"));
  });

  test("resolves empty instead of rejecting into the render path", async () => {
    await expect(loadDb().getGlyphBounds(MushafVersion.V2, 1)).resolves.toEqual([]);
  });
});

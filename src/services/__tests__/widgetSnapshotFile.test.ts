// In-memory expo-file-system so the atomic write can be observed call by call.
const mockFs = { files: new Map<string, string>(), ops: [] as string[] };

jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = `${base}/${name}`;
    }
    get exists() {
      return true;
    }
    create() {
      mockFs.ops.push(`mkdir ${this.uri}`);
    }
  }
  class File {
    uri: string;
    constructor(dir: Directory, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    create() {
      mockFs.files.set(this.uri, "");
      mockFs.ops.push(`create ${this.uri}`);
    }
    write(contents: string) {
      mockFs.files.set(this.uri, contents);
      mockFs.ops.push(`write ${this.uri}`);
    }
    delete() {
      mockFs.files.delete(this.uri);
      mockFs.ops.push(`delete ${this.uri}`);
    }
    async move(dest: File) {
      const contents = mockFs.files.get(this.uri) ?? "";
      mockFs.files.delete(this.uri);
      mockFs.files.set(dest.uri, contents);
      mockFs.ops.push(`move ${this.uri} -> ${dest.uri}`);
    }
  }
  return { File, Directory, Paths: { document: "/doc" } };
});

// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import {
  WIDGET_SNAPSHOT_VERSION,
  buildWidgetSnapshot,
  todayUtcBounds,
  writeSnapshotFile,
} from "@/services/widgetSnapshotFile";
// eslint-disable-next-line import/first
import type { WidgetSnapshotInputs } from "@/services/widgetSnapshotFile";

const day = (date: number) => ({
  date,
  timezone: "Asia/Riyadh",
  timings: { fajr: "f", dhuhr: "d", asr: "a", maghrib: "m", isha: "i" },
  otherTimings: {
    sunrise: "s",
    sunset: "",
    imsak: "",
    midnight: "",
    firstthird: "",
    lastthird: "",
  },
});

// 2026-09-06T01:00Z is 04:00 in Riyadh (UTC+3), so "today" there is the 6th.
const makeInputs = (overrides: Partial<WidgetSnapshotInputs> = {}): WidgetSnapshotInputs => ({
  nowMs: Date.parse("2026-09-06T01:00:00Z"),
  timezone: "Asia/Riyadh",
  hijriDaysOffset: 0,
  useWesternNumerals: false,
  prayerDays: [day(20260905), day(20260906), day(20260907), day(20260908), day(20260909)],
  hijriLabel: "١٤ ربيع الأول ١٤٤٨",
  importantDays: [{ id: "eid", name: "Eid", hijriLabel: "x", dateISO: "2026-09-20" }],
  athkar: {
    morning: { completed: 22, total: 22, completedAt: "2026-09-06T04:10:00.000Z" },
    evening: { completed: 0, total: 22, completedAt: null },
    streak: { current: 5, longest: 12 },
  },
  qadaTotals: { totalMissed: 30, totalCompleted: 12 },
  qadaCompletedToday: 1,
  ...overrides,
});

describe("buildWidgetSnapshot", () => {
  test("carries today and the next two days, in the snapshot timezone", () => {
    const s = buildWidgetSnapshot(makeInputs());
    expect(s.version).toBe(WIDGET_SNAPSHOT_VERSION);
    expect(s.prayerTimes.days.map((d) => d.date)).toEqual([20260906, 20260907, 20260908]);
    expect(s.prayerTimes.timezone).toBe("Asia/Riyadh");
  });

  test("drops a missing day rather than inventing one", () => {
    const s = buildWidgetSnapshot(makeInputs({ prayerDays: [day(20260906), day(20260908)] }));
    expect(s.prayerTimes.days.map((d) => d.date)).toEqual([20260906, 20260908]);
  });

  test("stamps every today-keyed group with the same date", () => {
    const s = buildWidgetSnapshot(makeInputs());
    expect(s.hijriToday.date).toBe(20260906);
    expect(s.athkar.date).toBe(20260906);
    expect(s.qada.date).toBe(20260906);
  });

  test("today follows the timezone, not UTC", () => {
    // 22:30Z on the 5th is 01:30 on the 6th in Riyadh.
    const s = buildWidgetSnapshot(makeInputs({ nowMs: Date.parse("2026-09-05T22:30:00Z") }));
    expect(s.athkar.date).toBe(20260906);
  });

  test("copies config, athkar and qada through unchanged", () => {
    const s = buildWidgetSnapshot(makeInputs());
    expect(s.config).toEqual({
      useWesternNumerals: false,
      timezone: "Asia/Riyadh",
      hijriDaysOffset: 0,
    });
    expect(s.athkar.streak).toEqual({ current: 5, longest: 12 });
    expect(s.qada).toEqual({
      date: 20260906,
      totalMissed: 30,
      totalCompleted: 12,
      completedToday: 1,
    });
  });
});

describe("todayUtcBounds", () => {
  test("brackets the local day in UTC", () => {
    expect(todayUtcBounds(Date.parse("2026-09-06T01:00:00Z"), "Asia/Riyadh")).toEqual({
      startIso: "2026-09-05T21:00:00.000Z",
      endIso: "2026-09-06T21:00:00.000Z",
    });
  });
});

describe("writeSnapshotFile", () => {
  beforeEach(() => {
    mockFs.files.clear();
    mockFs.ops.length = 0;
  });

  test("writes the whole document to a temp file, then renames it into place", async () => {
    const s = buildWidgetSnapshot(makeInputs());
    await writeSnapshotFile(s);

    expect(mockFs.ops).toEqual([
      "create /doc/widgets/snapshot.json.tmp",
      "write /doc/widgets/snapshot.json.tmp",
      "move /doc/widgets/snapshot.json.tmp -> /doc/widgets/snapshot.json",
    ]);
    expect(JSON.parse(mockFs.files.get("/doc/widgets/snapshot.json") ?? "")).toEqual(s);
    expect(mockFs.files.has("/doc/widgets/snapshot.json.tmp")).toBe(false);
  });

  test("replaces an existing snapshot and a stale temp file", async () => {
    mockFs.files.set("/doc/widgets/snapshot.json", "old");
    mockFs.files.set("/doc/widgets/snapshot.json.tmp", "torn");
    await writeSnapshotFile(buildWidgetSnapshot(makeInputs()));

    expect(mockFs.ops[0]).toBe("delete /doc/widgets/snapshot.json.tmp");
    expect(mockFs.ops).toContain("delete /doc/widgets/snapshot.json");
    expect(mockFs.files.get("/doc/widgets/snapshot.json")).not.toBe("old");
  });
});

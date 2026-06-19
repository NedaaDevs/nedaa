import {
  sessionMarker,
  parseSessions,
  pruneByAge,
  pruneGlobalBySize,
  buildBundle,
} from "@/utils/logBundle";

describe("session markers", () => {
  it("formats a marker with date, time, version, build", () => {
    expect(sessionMarker("2026-06-19 16:51", "2.10.0", "419")).toBe(
      "=== session 2026-06-19 16:51 · v2.10.0 (419) ==="
    );
  });

  it("parses markers with their dates and offsets", () => {
    const text =
      `=== session 2026-06-01 09:00 · v2.9.0 (400) ===\n` +
      `09:00:01.000 [INFO] A: first\n` +
      `=== session 2026-06-19 16:51 · v2.10.0 (419) ===\n` +
      `16:51:02.000 [INFO] A: second\n`;
    const spans = parseSessions(text);
    expect(spans).toHaveLength(2);
    expect(spans[0].date.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(spans[1].date.toISOString().slice(0, 10)).toBe("2026-06-19");
    expect(spans[0].markerStart).toBe(0);
    expect(spans[1].markerStart).toBe(text.indexOf("=== session 2026-06-19"));
  });

  it("returns [] when there are no markers", () => {
    expect(parseSessions("12:00:00.000 [INFO] A: orphan\n")).toEqual([]);
  });
});

describe("pruneByAge", () => {
  const NOW = new Date("2026-06-30T12:00:00Z");
  const text =
    `=== session 2026-05-01 09:00 · v1 (1) ===\n09:00:00.000 [INFO] A: old\n` +
    `=== session 2026-06-20 09:00 · v1 (1) ===\n09:00:00.000 [INFO] A: recent\n` +
    `=== session 2026-06-29 09:00 · v1 (1) ===\n09:00:00.000 [INFO] A: newest\n`;

  it("drops sessions older than maxDays", () => {
    const out = pruneByAge(text, NOW, 30);
    expect(out).not.toContain("A: old");
    expect(out).toContain("A: recent");
    expect(out).toContain("A: newest");
    expect(out.startsWith("=== session 2026-06-20")).toBe(true);
  });

  it("keeps only the most recent session when all are stale", () => {
    const out = pruneByAge(text, new Date("2027-01-01T00:00:00Z"), 30);
    expect(out).not.toContain("A: old");
    expect(out).not.toContain("A: recent");
    expect(out).toContain("A: newest");
  });

  it("returns text unchanged when nothing is stale", () => {
    expect(pruneByAge(text, NOW, 365)).toBe(text);
  });

  it("returns '' when there are no markers", () => {
    expect(pruneByAge("12:00:00.000 [INFO] A: orphan\n", NOW, 30)).toBe("");
  });
});

describe("pruneGlobalBySize", () => {
  const sess = (date: string, body: string) => `=== session ${date} 09:00 · v1 (1) ===\n${body}\n`;

  it("returns input unchanged when under cap", () => {
    const files = [{ domain: "a", text: sess("2026-06-01", "x") }];
    expect(pruneGlobalBySize(files, 10_000)).toEqual(files);
  });

  it("drops oldest sessions across domains until under cap", () => {
    const big = "y".repeat(2000);
    const files = [
      { domain: "a", text: sess("2026-06-01", big) + sess("2026-06-20", big) },
      { domain: "b", text: sess("2026-06-10", big) },
    ];
    const out = pruneGlobalBySize(files, 3000);
    const total = out.reduce((n, f) => n + Buffer.byteLength(f.text, "utf8"), 0);
    expect(total).toBeLessThanOrEqual(3000);
    // Oldest (a:2026-06-01) dropped first, then b:2026-06-10; newest (a:2026-06-20) survives.
    expect(out.find((f) => f.domain === "a")!.text).toContain("2026-06-20");
    expect(out.find((f) => f.domain === "a")!.text).not.toContain("2026-06-01");
  });
});

describe("buildBundle", () => {
  it("emits one header, description, and non-empty domain sections", () => {
    const out = buildBundle({
      header: [
        ["App", "2.10.0 (419)"],
        ["Device", "Apple iPhone 15 Pro"],
      ],
      category: "Audio",
      description: "playback stops after lock",
      sections: [
        { domain: "athkar-audio", text: "16:00:00.000 [INFO] Player: x\n" },
        { domain: "compass", text: "" },
      ],
    });
    expect(out).toContain("NEDAA DIAGNOSTIC REPORT");
    expect(out).toContain("App:     2.10.0 (419)");
    expect(out).toContain("Category: Audio");
    expect(out).toContain("playback stops after lock");
    expect(out).toContain("====== ATHKAR-AUDIO ======");
    expect(out).not.toContain("====== COMPASS ======"); // empty section skipped
    expect(out.match(/App:/g)).toHaveLength(1);
  });
});

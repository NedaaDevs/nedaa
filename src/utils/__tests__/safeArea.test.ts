import { SAFE_EDGE, isTodaySegments, rootSafeAreaEdges } from "@/utils/safeArea";

describe("rootSafeAreaEdges", () => {
  it("pads the top of an ordinary screen", () => {
    expect(rootSafeAreaEdges({ today: false, immersiveReader: false, android: false })).toEqual([
      SAFE_EDGE.TOP,
      SAFE_EDGE.RIGHT,
      SAFE_EDGE.LEFT,
    ]);
  });

  // Today draws its sky under the status bar and pads its own content instead.
  it.each([true, false])("leaves the top of Today open (android: %s)", (android) => {
    expect(rootSafeAreaEdges({ today: true, immersiveReader: false, android })).not.toContain(
      SAFE_EDGE.TOP
    );
  });

  it("opens the top for the immersive reader on Android only", () => {
    expect(rootSafeAreaEdges({ today: false, immersiveReader: true, android: true })).not.toContain(
      SAFE_EDGE.TOP
    );
    expect(rootSafeAreaEdges({ today: false, immersiveReader: true, android: false })).toContain(
      SAFE_EDGE.TOP
    );
  });
});

describe("isTodaySegments", () => {
  it.each([
    [["(tabs)"], true],
    [["(tabs)", "index"], true],
    [["(tabs)", "quran"], false],
    [["settings", "location"], false],
  ])("reads %j as Today: %s", (segments, today) => {
    expect(isTodaySegments(segments)).toBe(today);
  });
});

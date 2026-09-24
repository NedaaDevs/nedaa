import { SAFE_EDGE, isSkySegments, rootSafeAreaEdges } from "@/utils/safeArea";

describe("rootSafeAreaEdges", () => {
  it("pads the top of an ordinary screen", () => {
    expect(rootSafeAreaEdges({ sky: false, immersiveReader: false, android: false })).toEqual([
      SAFE_EDGE.TOP,
      SAFE_EDGE.RIGHT,
      SAFE_EDGE.LEFT,
    ]);
  });

  // A sky screen draws under the status bar and pads its own content instead.
  it.each([true, false])("leaves the top of a sky screen open (android: %s)", (android) => {
    expect(rootSafeAreaEdges({ sky: true, immersiveReader: false, android })).not.toContain(
      SAFE_EDGE.TOP
    );
  });

  it("opens the top for the immersive reader on Android only", () => {
    expect(rootSafeAreaEdges({ sky: false, immersiveReader: true, android: true })).not.toContain(
      SAFE_EDGE.TOP
    );
    expect(rootSafeAreaEdges({ sky: false, immersiveReader: true, android: false })).toContain(
      SAFE_EDGE.TOP
    );
  });
});

describe("isSkySegments", () => {
  it.each([
    [["(tabs)"], true],
    [["(tabs)", "index"], true],
    [["(tabs)", "tools"], true],
    [["(tabs)", "quran"], false],
    [["settings", "location"], false],
  ])("reads %j as a sky screen: %s", (segments, sky) => {
    expect(isSkySegments(segments)).toBe(sky);
  });
});

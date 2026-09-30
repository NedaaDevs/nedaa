import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { TOAST_GAP } from "@/constants/Toast";
import { SAFE_EDGE, isSkySegments, rootSafeAreaEdges, toastBottom } from "@/utils/safeArea";

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

  // About and Privacy are stack screens drawn on the sky.
  it.each([BACK_DESTINATION.SETTINGS_ABOUT, BACK_DESTINATION.SETTINGS_PRIVACY])(
    "reads $route as a sky screen",
    ({ route }) => {
      expect(isSkySegments(route.split("/"))).toBe(true);
    }
  );
});

describe("toastBottom", () => {
  const BAR = 92;
  const INSET = 34;

  // The measured frame holds the bar, any mini player and the bottom inset.
  const segmentsOf = ({ route }: { route: string }) => route.split("/");
  const [TABS] = segmentsOf(BACK_DESTINATION.HOME);

  it.each([
    ["Today, under the floating bar", [TABS], BAR, BAR],
    ["Athkar, above the bar in the flow", segmentsOf(BACK_DESTINATION.ATHKAR), BAR, BAR],
    ["the Quran reader, where the bar is gone", segmentsOf(BACK_DESTINATION.QURAN), 0, INSET],
    ["a tab before the bar has measured", segmentsOf(BACK_DESTINATION.TOOLS), 0, INSET],
    [
      "a stack screen, where the bar's height is stale",
      segmentsOf(BACK_DESTINATION.SETTINGS_LOCATION),
      BAR,
      INSET,
    ],
  ])("clears %s", (_name, segments, tabBarHeight, clears) => {
    expect(toastBottom({ segments, tabBarHeight, insetBottom: INSET })).toBe(clears + TOAST_GAP);
  });
});

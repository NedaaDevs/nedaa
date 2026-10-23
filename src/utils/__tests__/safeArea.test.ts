import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { TOAST_GAP } from "@/constants/Toast";
import { TAB_BAR_EDGE_GAP } from "@/constants/TabBar";
import {
  SAFE_EDGE,
  isSkySegments,
  rootSafeAreaEdges,
  tabBarEdgeGap,
  toastBottom,
} from "@/utils/safeArea";

/** A routed screen: no onboarding flow over it, no immersive reader. */
const ROUTE = { onboarding: false, immersiveReader: false };

describe("rootSafeAreaEdges", () => {
  it("pads the top of an ordinary screen", () => {
    expect(rootSafeAreaEdges({ ...ROUTE, sky: false, android: false })).toEqual([
      SAFE_EDGE.TOP,
      SAFE_EDGE.RIGHT,
      SAFE_EDGE.LEFT,
    ]);
  });

  // A sky screen draws under the status bar and pads its own content instead.
  it.each([true, false])("leaves the top of a sky screen open (android: %s)", (android) => {
    expect(rootSafeAreaEdges({ ...ROUTE, sky: true, android })).not.toContain(SAFE_EDGE.TOP);
  });

  // The flow draws on the sky over any route, so it pads its own top.
  it.each([true, false])("leaves the top open under the onboarding flow (sky: %s)", (sky) => {
    expect(rootSafeAreaEdges({ ...ROUTE, sky, onboarding: true, android: true })).not.toContain(
      SAFE_EDGE.TOP
    );
  });

  it("opens the top for the immersive reader on Android only", () => {
    expect(
      rootSafeAreaEdges({ ...ROUTE, sky: false, immersiveReader: true, android: true })
    ).not.toContain(SAFE_EDGE.TOP);
    expect(
      rootSafeAreaEdges({ ...ROUTE, sky: false, immersiveReader: true, android: false })
    ).toContain(SAFE_EDGE.TOP);
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

describe("tabBarEdgeGap", () => {
  const GAP = TAB_BAR_EDGE_GAP;

  // The home indicator sits in the gap under the pill, where it takes no touch.
  it.each([0, 20, 34])("holds the pill %s above an iPhone's edge", (insetBottom) => {
    expect(tabBarEdgeGap({ android: false, insetBottom })).toBe(GAP);
  });

  // Android's bottom inset is a navigation bar that takes touches.
  it.each([
    [0, GAP],
    [16, GAP],
    [24, 24],
    [48, 48],
  ])("keeps the pill clear of an Android inset of %s", (insetBottom, gap) => {
    expect(tabBarEdgeGap({ android: true, insetBottom })).toBe(gap);
  });
});

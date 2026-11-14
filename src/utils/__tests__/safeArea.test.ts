import { BACK_DESTINATION, TAB_GROUP } from "@/constants/BackDestinations";
import { TOAST_GAP } from "@/constants/Toast";
import { TAB_BAR_EDGE_GAP } from "@/constants/TabBar";
import { isQuranSegments, isSkyRoute, tabBarEdgeGap, toastBottom } from "@/utils/safeArea";

const segmentsOf = ({ route }: { route: string }) => route.split("/");

describe("isSkyRoute", () => {
  it.each([
    ["Today", BACK_DESTINATION.HOME.route, true],
    ["the Settings tab", BACK_DESTINATION.SETTINGS.route, true],
    ["Location, a stack screen", BACK_DESTINATION.SETTINGS_LOCATION.route, true],
    ["Calculation, a folder down", BACK_DESTINATION.SETTINGS_PROVIDER.route, true],
    ["the Quran tab", BACK_DESTINATION.QURAN.route, false],
    ["Acknowledgements", BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS.route, false],
    ["the tab group, which is no screen", TAB_GROUP, false],
  ])("reads %s (%s) as a sky screen: %s", (_name, route, sky) => {
    expect(isSkyRoute(route)).toBe(sky);
  });
});

describe("toastBottom", () => {
  const BAR = 92;
  const INSET = 34;

  // The measured frame holds the bar, any mini player and the bottom inset.
  it.each([
    ["Today, under the floating bar", [TAB_GROUP], BAR, BAR],
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

describe("isQuranSegments", () => {
  it.each([
    ["the Quran tab", segmentsOf(BACK_DESTINATION.QURAN), true],
    ["a screen under the Quran tab", [...segmentsOf(BACK_DESTINATION.QURAN), "reader"], true],
    ["another tab", segmentsOf(BACK_DESTINATION.TOOLS), false],
    ["Listen, outside the tabs", segmentsOf(BACK_DESTINATION.QURAN_LISTEN), false],
  ])("reads %s: %s", (_name, segments, quran) => {
    expect(isQuranSegments(segments)).toBe(quran);
  });
});

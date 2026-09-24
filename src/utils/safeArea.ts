import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { isSkyTab } from "@/constants/SkyTabs";
import { TOAST_GAP } from "@/constants/Toast";
import { OpeningTab } from "@/enums/app";

export const SAFE_EDGE = { TOP: "top", RIGHT: "right", LEFT: "left" } as const;
export type SafeEdge = (typeof SAFE_EDGE)[keyof typeof SAFE_EDGE];

const [TAB_GROUP] = BACK_DESTINATION.HOME.route.split("/");

/** A tab drawn on the sky; the router may omit the name of Today, the index. */
export const isSkySegments = (segments: readonly string[]) =>
  segments[0] === TAB_GROUP && isSkyTab(segments[1] ?? OpeningTab.HOME);

type Screen = { sky: boolean; immersiveReader: boolean; android: boolean };

// A sky screen draws under the status bar and pads its own content. Android's
// reader goes full-bleed so hiding the bar never reflows the page; iOS keeps
// the top edge, since the notch inset stays whether the bar shows or not.
export const rootSafeAreaEdges = ({ sky, immersiveReader, android }: Screen): SafeEdge[] =>
  sky || (immersiveReader && android)
    ? [SAFE_EDGE.RIGHT, SAFE_EDGE.LEFT]
    : [SAFE_EDGE.TOP, SAFE_EDGE.RIGHT, SAFE_EDGE.LEFT];

type ToastPlacement = { segments: readonly string[]; tabBarHeight: number; insetBottom: number };

// On a tab route the measured frame covers the bar and any mini player, the
// inset its floor; elsewhere that measurement is stale.
export const toastBottom = ({ segments, tabBarHeight, insetBottom }: ToastPlacement) =>
  (segments[0] === TAB_GROUP ? Math.max(tabBarHeight, insetBottom) : insetBottom) + TOAST_GAP;

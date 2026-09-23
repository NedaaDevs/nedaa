import { BACK_DESTINATION } from "@/constants/BackDestinations";

export const SAFE_EDGE = { TOP: "top", RIGHT: "right", LEFT: "left" } as const;
export type SafeEdge = (typeof SAFE_EDGE)[keyof typeof SAFE_EDGE];

const [TAB_GROUP, TODAY_SCREEN] = BACK_DESTINATION.HOME.route.split("/");

/** Today is the tab group's index; the router may omit the index's name. */
export const isTodaySegments = (segments: readonly string[]) =>
  segments[0] === TAB_GROUP && (segments.length === 1 || segments[1] === TODAY_SCREEN);

type Screen = { today: boolean; immersiveReader: boolean; android: boolean };

// Today draws its sky under the status bar and pads its own content. Android's
// reader goes full-bleed so hiding the bar never reflows the page; iOS keeps
// the top edge, since the notch inset stays whether the bar shows or not.
export const rootSafeAreaEdges = ({ today, immersiveReader, android }: Screen): SafeEdge[] =>
  today || (immersiveReader && android)
    ? [SAFE_EDGE.RIGHT, SAFE_EDGE.LEFT]
    : [SAFE_EDGE.TOP, SAFE_EDGE.RIGHT, SAFE_EDGE.LEFT];

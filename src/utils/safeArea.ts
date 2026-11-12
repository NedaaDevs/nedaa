import {
  BACK_DESTINATION,
  TAB_GROUP,
  type BackDestinationEntry,
} from "@/constants/BackDestinations";
import { TAB_BAR_EDGE_GAP } from "@/constants/TabBar";
import { TOAST_GAP } from "@/constants/Toast";

export const SAFE_EDGE = { TOP: "top", RIGHT: "right", LEFT: "left" } as const;

const [, QURAN_TAB] = BACK_DESTINATION.QURAN.route.split("/");

/** The Quran tab or a screen under it. */
export const isQuranSegments = (segments: readonly string[]) =>
  segments[0] === TAB_GROUP && segments[1] === QURAN_TAB;

const DESTINATIONS: readonly BackDestinationEntry[] = Object.values(BACK_DESTINATION);

const SKY_ROUTES: ReadonlySet<string> = new Set(
  DESTINATIONS.filter(({ sky }) => sky).map(({ route }) => route)
);

/** A screen drawn on the sky, by the navigator's name for it. */
export const isSkyRoute = (route: string) => SKY_ROUTES.has(route);

type ToastPlacement = { segments: readonly string[]; tabBarHeight: number; insetBottom: number };

// On a tab route the measured frame covers the bar and any mini player, the
// inset its floor; elsewhere that measurement is stale.
export const toastBottom = ({ segments, tabBarHeight, insetBottom }: ToastPlacement) =>
  (segments[0] === TAB_GROUP ? Math.max(tabBarHeight, insetBottom) : insetBottom) + TOAST_GAP;

type TabBarEdge = { android: boolean; insetBottom: number };

// iOS's bottom inset is the home indicator, which the gap holds; Android's is
// a navigation bar, which the bar must clear.
export const tabBarEdgeGap = ({ android, insetBottom }: TabBarEdge) =>
  android ? Math.max(TAB_BAR_EDGE_GAP, insetBottom) : TAB_BAR_EDGE_GAP;

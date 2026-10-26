import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { View, type RadiusTokens } from "tamagui";

import { useBrightness, useThemeColor } from "@/components/ui/theme-color";
import { ELEVATION, ELEVATION_LEVEL, type ElevationLevel } from "@/constants/Elevation";

/** Test id of an edge whose surface has none of its own. */
export const HIGHLIGHT_EDGE_ID = "highlight-edge";

/** The level's shadow for the current theme; undefined where it draws none. */
export const useElevationShadow = (level: ElevationLevel): string | undefined =>
  ELEVATION[level].boxShadow[useBrightness()] ?? undefined;

type HighlightEdgeProps = {
  /** The surface's test id; the edge takes it with a `-highlight` suffix. */
  owner?: string;
  /** The surface's own `borderRadius`, whose curve the line follows. */
  radius?: RadiusTokens;
};

/** The 1pt lit top edge of a surface, inset along its rounded corners. */
export const HighlightEdge = ({ owner, radius = "$card" }: HighlightEdgeProps) => {
  const highlight = useThemeColor("$highlight");

  return (
    <View
      testID={owner ? `${owner}-highlight` : HIGHLIGHT_EDGE_ID}
      pointerEvents="none"
      borderRadius={radius}
      style={[StyleSheet.absoluteFill, { boxShadow: `inset 0 1px 0 ${highlight}` }]}
    />
  );
};

type RestingSurface = {
  /** The e1 lift, for the surface's own style. */
  lift: { boxShadow?: string };
  /** The lit top edge, drawn as the surface's first child. */
  edge: ReactElement;
};

/** The one resting look: the e1 lift and a lit top edge along the corners. */
export const useRestingSurface = (edge: HighlightEdgeProps = {}): RestingSurface => ({
  lift: { boxShadow: useElevationShadow(ELEVATION_LEVEL.E1) },
  edge: <HighlightEdge {...edge} />,
});

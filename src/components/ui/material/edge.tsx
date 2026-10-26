import { StyleSheet } from "react-native";
import { View, type RadiusTokens } from "tamagui";

import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { ELEVATION, type ElevationLevel } from "@/constants/Elevation";

/** Test id of an edge whose surface has none of its own. */
export const HIGHLIGHT_EDGE_ID = "highlight-edge";

/** The level's shadow for the current theme; undefined where it draws none. */
export const useElevationShadow = (level: ElevationLevel): string | undefined => {
  const isDark = useIsDarkTheme();
  return ELEVATION[level].boxShadow[isDark ? "dark" : "light"] ?? undefined;
};

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

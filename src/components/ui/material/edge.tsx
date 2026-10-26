import { StyleSheet } from "react-native";
import { getTokenValue, View } from "tamagui";

import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { ELEVATION, type ElevationLevel } from "@/constants/Elevation";

/** The radius scale's names, whose curve a lit edge follows. */
export const RADIUS_NAMES = ["chip", "control", "card", "sheet", "hero", "pill"] as const;
export type RadiusName = (typeof RADIUS_NAMES)[number];

/** The radius name a `$name` radius prop sets; undefined for anything else. */
export const radiusNameOf = (value: unknown): RadiusName | undefined =>
  RADIUS_NAMES.find((name) => value === `$${name}`);

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
  radius?: RadiusName;
};

/** The 1pt lit top edge of a surface, inset along its rounded corners. */
export const HighlightEdge = ({ owner, radius = "card" }: HighlightEdgeProps) => {
  const highlight = useThemeColor("$highlight");

  return (
    <View
      testID={owner ? `${owner}-highlight` : HIGHLIGHT_EDGE_ID}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: getTokenValue(`$${radius}`, "radius"),
          boxShadow: `inset 0 1px 0 ${highlight}`,
        },
      ]}
    />
  );
};

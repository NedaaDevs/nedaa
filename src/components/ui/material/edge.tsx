import { getTokenValue, View } from "tamagui";

import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { ELEVATION, type ElevationLevel } from "@/constants/Elevation";

/** The radius scale's names, which a lit edge clears at either end. */
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

/** The 1pt lit top edge of a surface, held clear of its rounded corners. */
export const HighlightEdge = ({ owner, radius = "card" }: HighlightEdgeProps) => {
  const highlight = useThemeColor("$highlight");
  const corner = getTokenValue(`$${radius}`, "radius");

  return (
    <View
      testID={owner ? `${owner}-highlight` : HIGHLIGHT_EDGE_ID}
      position="absolute"
      top={0}
      start={corner}
      end={corner}
      height={1}
      pointerEvents="none"
      style={{ backgroundColor: highlight }}
    />
  );
};

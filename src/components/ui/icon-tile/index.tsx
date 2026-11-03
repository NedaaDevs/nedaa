import { Box } from "@/components/ui/box";
import { Icon, type IconProps } from "@/components/ui/icon";

/** Test id for the tile's frame. */
export const ICON_TILE_ID = "icon-tile";

/** A glyph tile's side, from the list row design; no size token is 34. */
export const TILE_SIZE = 34;
/** The glyph's stroke on the tile, and the chevron beside a tiled row. */
export const TILE_STROKE = 1.75;

/** The glyph's colour; the tile keeps its tint in every tone. */
export const ICON_TILE_TONE = {
  ACCENT: "accent",
  SUCCESS: "success",
  DANGER: "danger",
  MUTED: "muted",
} as const;
export type IconTileTone = (typeof ICON_TILE_TONE)[keyof typeof ICON_TILE_TONE];

type Props = { icon: IconProps["as"]; tone?: IconTileTone };

/** A glyph on a tinted square, in the accent unless a tone says otherwise. */
export const IconTile = ({ icon, tone = ICON_TILE_TONE.ACCENT }: Props) => (
  <Box
    testID={ICON_TILE_ID}
    width={TILE_SIZE}
    height={TILE_SIZE}
    borderRadius="$chip"
    backgroundColor="$tile"
    alignItems="center"
    justifyContent="center">
    <Icon as={icon} size="lg" color={`$${tone}`} strokeWidth={TILE_STROKE} />
  </Box>
);

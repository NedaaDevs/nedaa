import { Box } from "@/components/ui/box";
import { Icon, type IconProps } from "@/components/ui/icon";

/** Test id for the tile's frame. */
export const ICON_TILE_ID = "icon-tile";

/** The tile's side, from the Settings design; no size token is 38. */
const TILE_SIZE = 38;
/** The glyph's stroke on the tile, and the chevron beside a tiled row. */
export const TILE_STROKE = 1.75;

type Props = { icon: IconProps["as"] };

/** A glyph in the accent on a tinted square; it marks what it heads. */
export const IconTile = ({ icon }: Props) => (
  <Box
    testID={ICON_TILE_ID}
    width={TILE_SIZE}
    height={TILE_SIZE}
    borderRadius="$control"
    backgroundColor="$tile"
    alignItems="center"
    justifyContent="center">
    <Icon as={icon} size="lg" color="$accent" strokeWidth={TILE_STROKE} />
  </Box>
);

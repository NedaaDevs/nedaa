import { createContext, use, useState, type ReactNode } from "react";
import {
  PixelRatio,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { getTokenValue, type SpaceTokens } from "tamagui";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the grid and its items. */
export const GRID_PART = { ROOT: "grid", ITEM: "grid-item" } as const;

/** A moved item glides to its new place and width, then settles. */
const GLIDE = LinearTransition.duration(420).easing(Easing.out(Easing.cubic));

type Columns = { column?: number; full?: number; share: DimensionValue; animate: boolean };

const GridContext = createContext<Columns>({ share: "50%", animate: false });

/** A space token by name; a raw number would bypass the scale. */
type SpaceName = Extract<SpaceTokens, `$${string}`>;

type GridProps = { columns: number; gap: SpaceName; children: ReactNode };

/** Equal columns, items wrapping row by row; a wide item takes a whole row. */
const GridRoot = ({ columns, gap, children }: GridProps) => {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState<number>();
  const space = Number(getTokenValue(gap, "space"));
  const column = width === undefined ? undefined : (width - space * (columns - 1)) / columns;

  return (
    <View
      testID={GRID_PART.ROOT}
      onLayout={({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space, rowGap: space }}>
      <GridContext
        value={{ column, full: width, share: `${100 / columns - 2}%`, animate: !reduced }}>
        {children}
      </GridContext>
    </View>
  );
};

type Cell = Omit<Columns, "animate"> & { wide?: boolean; hairline: number };

// A measured width is pixel-rounded and Yoga wraps on any overflow, so a
// column cell starts one hairline short and grows back to at most a column.
export const gridCellStyle = ({ wide, column, full, share, hairline }: Cell): ViewStyle => {
  if (wide) return { width: full ?? "100%" };
  if (column === undefined) return { width: share };
  return { flexBasis: column - hairline, flexGrow: 1, maxWidth: column };
};

/** One cell; `wide` spans the row. */
const GridItem = ({ wide, children }: { wide?: boolean; children: ReactNode }) => {
  const { animate, ...columns } = use(GridContext);
  const style = gridCellStyle({ ...columns, wide, hairline: 1 / PixelRatio.get() });

  return (
    <Animated.View testID={GRID_PART.ITEM} layout={animate ? GLIDE : undefined} style={style}>
      {children}
    </Animated.View>
  );
};

export const Grid = Object.assign(GridRoot, { Item: GridItem });

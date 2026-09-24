import { createContext, use, useState, type ReactNode } from "react";
import { View, type DimensionValue, type LayoutChangeEvent } from "react-native";
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

/** One cell; `wide` spans the row. Before measuring it takes a share. */
const GridItem = ({ wide, children }: { wide?: boolean; children: ReactNode }) => {
  const { column, full, share, animate } = use(GridContext);
  const width = (wide ? full : column) ?? (wide ? "100%" : share);

  return (
    <Animated.View testID={GRID_PART.ITEM} layout={animate ? GLIDE : undefined} style={{ width }}>
      {children}
    </Animated.View>
  );
};

export const Grid = Object.assign(GridRoot, { Item: GridItem });

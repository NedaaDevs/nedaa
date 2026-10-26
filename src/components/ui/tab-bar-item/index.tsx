import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { getTokenValue } from "tamagui";

import { Box } from "@/components/ui/box";
import { Icon, type IconProps } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { SPRING } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the bar's parts. */
export const TAB_BAR_ITEM_PART = {
  TRACK: "tab-bar-track",
  INDICATOR: "tab-bar-indicator",
  ICON: "tab-bar-icon",
} as const;

/** Lighter than the icon default, so four glyphs in a row do not read bold. */
const TAB_ICON_STROKE = 1.7;

/** The track's inset around its tabs, as a space token. */
const TRACK_INSET = "$1";

/** The size an icon pops from when its tab is chosen. */
const ICON_POP_FROM = 0.92;

type IndicatorProps = { index: number; count: number; trackWidth: number };

/** The accent pill under the chosen tab. */
const Indicator = ({ index, count, trackWidth }: IndicatorProps) => {
  const tint = useThemeColor("$accentTint");
  return (
    <SlidingIndicator
      testID={TAB_BAR_ITEM_PART.INDICATOR}
      index={index}
      count={count}
      trackWidth={trackWidth}
      inset={getTokenValue(TRACK_INSET, "space")}
      gap={0}
      style={{ borderRadius: getTokenValue("$pill", "radius"), backgroundColor: tint }}
    />
  );
};

type TabBarProps = {
  accessibilityLabel?: string;
  /** The chosen tab's place in the bar; outside it, no pill draws. */
  selectedIndex: number;
  count: number;
  /** The bar's gap above the screen's bottom edge. */
  edgeGap?: number;
  children: ReactNode;
};

/** The floating pill that holds the tabs, the chosen one on an accent pill. */
export const TabBar = ({
  accessibilityLabel,
  selectedIndex,
  count,
  edgeGap = 0,
  children,
}: TabBarProps) => {
  const { direction } = useRTL();
  const [trackWidth, setTrackWidth] = useState(0);
  const inset = getTokenValue(TRACK_INSET, "space");
  const sideGap = getTokenValue("$3.5", "space");

  return (
    <Material
      testID={TAB_BAR_ITEM_PART.TRACK}
      material={MATERIAL.FLOAT}
      radius="pill"
      ring
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={({ nativeEvent }: LayoutChangeEvent) => setTrackWidth(nativeEvent.layout.width)}
      // Set here too, so a host in another direction still mirrors the row.
      style={{
        direction,
        flexDirection: "row",
        height: getTokenValue("$16", "size"),
        padding: inset,
        marginStart: sideGap,
        marginEnd: sideGap,
        marginBottom: edgeGap,
      }}>
      {trackWidth > 0 && selectedIndex >= 0 && selectedIndex < count ? (
        <Indicator index={selectedIndex} count={count} trackWidth={trackWidth} />
      ) : null}
      {children}
    </Material>
  );
};

type Props = {
  label: string;
  icon: IconProps["as"];
  selected: boolean;
  onPress: () => void;
};

export const TabBarItem = ({ label, icon, selected, onPress }: Props) => {
  const colour = selected ? "$accentText" : "$muted";
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const wasSelected = useRef(selected);

  // The icon pops once as its tab is chosen; it rests on the first draw.
  useEffect(() => {
    const chosen = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!chosen || reduced) return;
    scale.set(ICON_POP_FROM);
    scale.set(withSpring(1, SPRING.SNAP));
  }, [selected, reduced, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      target="tab"
      role="tab"
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$0.5"
      paddingHorizontal="$0.5"
      borderRadius="$pill"
      backgroundColor="transparent">
      <Box pointerEvents="none">
        <Animated.View testID={TAB_BAR_ITEM_PART.ICON} style={pop}>
          <Icon as={icon} size="xl" color={colour} strokeWidth={TAB_ICON_STROKE} />
        </Animated.View>
      </Box>
      <Text size="sm" fontWeight="600" color={colour} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

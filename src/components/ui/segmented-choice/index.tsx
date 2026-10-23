import { useEffect, useRef, useState } from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { getTokenValue } from "tamagui";

import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { CONTACT_SHADOW } from "@/constants/Elevation";
import { SPRING } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { isolateLatinNumbers, localizeDigits } from "@/utils/digits";

export const SEGMENTED_FORM = {
  /** One sunken track, its options in equal parts under a sliding indicator. */
  FRAMED: "framed",
  /** A wrapping row of edged pills, for a long run of short options. */
  COMPACT: "compact",
} as const;
export type SegmentedForm = (typeof SEGMENTED_FORM)[keyof typeof SEGMENTED_FORM];

/** Test ids for the choice's parts. */
export const SEGMENTED_PART = { INDICATOR: "segmented-choice-indicator" } as const;

/** The track's inset and the gap between its segments, as a space token. */
const TRACK_INSET = "$1";

export type SegmentedChoiceProps<V extends string | number> = {
  /** The options in reading order: the `as const` list itself. */
  options: readonly V[];
  /** The chosen option. A value outside `options` leaves none selected. */
  value: V;
  onChange: (value: V) => void;
  /** Names the group for a screen reader. */
  accessibilityLabel: string;
  /** An option's visible text. Its digits follow the numeral preference. */
  label: (option: V) => string;
  /** An option's spoken name, where its visible text is a bare number. */
  spokenLabel?: (option: V) => string;
  /** Shows every option's digits as written, such as «123» beside «١٢٣». */
  literalDigits?: boolean;
  /** An icon over each option's text. */
  icon?: (option: V) => IconProps["as"];
  form?: SegmentedForm;
};

type IndicatorProps = { index: number; count: number; trackWidth: number };

/** The raised mark under the chosen segment, placed from the start edge. */
const Indicator = ({ index, count, trackWidth }: IndicatorProps) => {
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const raised = useThemeColor("$raised");
  const shadow = CONTACT_SHADOW[useIsDarkTheme() ? "dark" : "light"];
  const inset = getTokenValue(TRACK_INSET, "space");
  const width = (trackWidth - inset * (count + 1)) / count;
  const offset = index * (width + inset);
  // Subtracting from 0 keeps the first segment at 0, never -0.
  const target = isRTL ? 0 - offset : offset;
  const x = useSharedValue(target);
  // Null until first placed, so the first placement jumps.
  const placedWidth = useRef<number | null>(null);

  useEffect(() => {
    // A new width places the mark at once; only a new choice slides it.
    const resized = placedWidth.current !== width;
    placedWidth.current = width;
    x.set(reduced || resized ? target : withSpring(target, SPRING.SNAP));
  }, [target, width, reduced, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Animated.View
      testID={SEGMENTED_PART.INDICATOR}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.indicator,
        {
          top: inset,
          bottom: inset,
          start: inset,
          width,
          borderRadius: getTokenValue("$chip", "radius"),
          backgroundColor: raised,
          boxShadow: shadow,
        },
        slide,
      ]}
    />
  );
};

/** One choice of several: a framed track with a sliding mark, or compact pills. */
export const SegmentedChoice = <V extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  label,
  spokenLabel = label,
  literalDigits = false,
  icon,
  form = SEGMENTED_FORM.FRAMED,
}: SegmentedChoiceProps<V>) => {
  const { isRTL, direction } = useRTL();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const [trackWidth, setTrackWidth] = useState(0);
  const framed = form === SEGMENTED_FORM.FRAMED;
  const chosen = options.indexOf(value);

  return (
    <HStack
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      flexWrap={framed ? "nowrap" : "wrap"}
      // Set here too, so a host in another direction still mirrors the row.
      style={{ direction }}
      {...(framed
        ? {
            gap: TRACK_INSET,
            padding: TRACK_INSET,
            borderRadius: "$control",
            backgroundColor: "$quietTint",
            onLayout: ({ nativeEvent }: LayoutChangeEvent) =>
              setTrackWidth(nativeEvent.layout.width),
          }
        : { spacing: "tight" })}>
      {framed && trackWidth > 0 && chosen >= 0 ? (
        <Indicator index={chosen} count={options.length} trackWidth={trackWidth} />
      ) : null}
      {options.map((option) => {
        const selected = option === value;
        const digits = (text: string) =>
          literalDigits ? text : localizeDigits(text, locale, western);
        const text = digits(label(option));
        const colour = selected ? "$fg" : "$muted";
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={digits(spokenLabel(option))}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(option);
            }}
            alignItems="center"
            justifyContent="center"
            {...(framed
              ? {
                  flexGrow: 1,
                  flexBasis: 0,
                  paddingHorizontal: "$1",
                  borderRadius: "$chip",
                  backgroundColor: "transparent",
                  ...(icon && { gap: "$0.5", minHeight: "$12", paddingVertical: "$1" }),
                }
              : {
                  paddingHorizontal: "$3",
                  borderWidth: 1,
                  borderColor: selected ? "$accentEdge" : "$border",
                  borderRadius: "$pill",
                  backgroundColor: selected ? "$accentSoft" : "transparent",
                })}>
            {icon ? <Icon as={icon(option)} size="md" color={colour} /> : null}
            <Text
              size={icon ? "xs" : framed ? "md" : "sm"}
              typography="helper"
              fontWeight="600"
              color={colour}
              textAlign="center"
              numberOfLines={icon ? 1 : undefined}>
              {isRTL ? isolateLatinNumbers(text) : text}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
};

const styles = StyleSheet.create({ indicator: { position: "absolute" } });

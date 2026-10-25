import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { getTokenValue } from "tamagui";

import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { Text } from "@/components/ui/text";
import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { CONTACT_SHADOW } from "@/constants/Elevation";
import { useRTL } from "@/contexts/RTLContext";
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
  /** An option's test id, where a flow taps it. */
  optionTestID?: (option: V) => string | undefined;
  /** What choosing an option does, where it does more than select it. */
  optionHint?: (option: V) => string | undefined;
  /** Holds every option still, such as while the choice is being applied. */
  disabled?: boolean;
};

type IndicatorProps = { index: number; count: number; trackWidth: number };

/** The raised mark under the chosen segment. */
const Indicator = ({ index, count, trackWidth }: IndicatorProps) => {
  const raised = useThemeColor("$raised");
  const shadow = CONTACT_SHADOW[useIsDarkTheme() ? "dark" : "light"];
  const inset = getTokenValue(TRACK_INSET, "space");

  return (
    <SlidingIndicator
      testID={SEGMENTED_PART.INDICATOR}
      index={index}
      count={count}
      trackWidth={trackWidth}
      inset={inset}
      gap={inset}
      style={{
        borderRadius: getTokenValue("$chip", "radius"),
        backgroundColor: raised,
        boxShadow: shadow,
      }}
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
  optionTestID,
  optionHint,
  disabled = false,
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
            testID={optionTestID?.(option)}
            accessibilityRole="radio"
            accessibilityLabel={digits(spokenLabel(option))}
            accessibilityHint={optionHint?.(option)}
            accessibilityState={{ selected }}
            disabled={disabled}
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

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useRTL } from "@/contexts/RTLContext";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { isolateLatinNumbers, localizeDigits } from "@/utils/digits";

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
};

/** A row of pills with one chosen, wrapping when they do not fit. */
export const SegmentedChoice = <V extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  label,
  spokenLabel = label,
}: SegmentedChoiceProps<V>) => {
  const { isRTL, direction } = useRTL();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const digits = (text: string) => localizeDigits(text, locale, western);

  return (
    <HStack
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      flexWrap="wrap"
      spacing="tight"
      // Set here too, so a host outside the app's direction still mirrors the row.
      style={{ direction }}>
      {options.map((option) => {
        const selected = option === value;
        const text = digits(label(option));
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
            paddingHorizontal="$3"
            borderRadius="$pill"
            borderWidth={1}
            borderColor={selected ? "$accentEdge" : "$border"}
            backgroundColor={selected ? "$accentSoft" : "transparent"}>
            <Text
              size="sm"
              typography="helper"
              fontWeight="600"
              color={selected ? "$fg" : "$muted"}>
              {isRTL ? isolateLatinNumbers(text) : text}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
};

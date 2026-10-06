import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
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
  /** Shows every option's digits as written, such as «123» beside «١٢٣». */
  literalDigits?: boolean;
  /** An icon over each option's text; the options then share the row equally. */
  icon?: (option: V) => IconProps["as"];
};

/** A row of pills with one chosen, or of equal icon tiles when given icons. */
export const SegmentedChoice = <V extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  label,
  spokenLabel = label,
  literalDigits = false,
  icon,
}: SegmentedChoiceProps<V>) => {
  const { isRTL, direction } = useRTL();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  return (
    <HStack
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      flexWrap={icon ? "nowrap" : "wrap"}
      spacing="tight"
      // Set here too, so a host outside the app's direction still mirrors the row.
      style={{ direction }}>
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
            borderWidth={1}
            borderColor={selected ? "$accentEdge" : "$border"}
            {...(icon
              ? {
                  flexGrow: 1,
                  flexBasis: 0,
                  gap: "$0.5",
                  minHeight: "$12",
                  paddingVertical: "$1",
                  paddingHorizontal: "$0.5",
                  borderRadius: "$control",
                  backgroundColor: selected ? "$accentSoft" : "$surface2Soft",
                }
              : {
                  paddingHorizontal: "$3",
                  borderRadius: "$pill",
                  backgroundColor: selected ? "$accentSoft" : "transparent",
                })}>
            {icon ? <Icon as={icon(option)} size="md" color={colour} /> : null}
            <Text
              size={icon ? "xs" : "sm"}
              typography="helper"
              fontWeight="600"
              color={colour}
              numberOfLines={icon ? 1 : undefined}>
              {isRTL ? isolateLatinNumbers(text) : text}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
};

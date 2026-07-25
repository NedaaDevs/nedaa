import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { Minus } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";

export const Section = ({
  title,
  chrome,
  children,
}: {
  title: string;
  chrome: QuranChromeColors;
  children: React.ReactNode;
}) => (
  <YStack gap="$2">
    <Text fontSize={13} fontWeight="700" color={chrome.subtleText}>
      {title}
    </Text>
    {children}
  </YStack>
);

// `stacked` puts the control on its own full-width line below the label —
// for wide controls (e.g. segmented options) that would crowd a single row.
export const SettingRow = ({
  label,
  chrome,
  stacked,
  children,
}: {
  label: string;
  chrome: QuranChromeColors;
  stacked?: boolean;
  children: React.ReactNode;
}) =>
  stacked ? (
    <YStack gap="$2" paddingHorizontal="$3" paddingVertical="$2">
      <Text fontSize={15} color={chrome.subtleText}>
        {label}
      </Text>
      {children}
    </YStack>
  ) : (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$3"
      minHeight={44}>
      <Text fontSize={15} color={chrome.subtleText}>
        {label}
      </Text>
      {children}
    </XStack>
  );

// Optional per-option illustration, rendered above the label. Receives the
// segment's active state and resolved text colour so the glyph can match.
type SegmentIcon = (props: { active: boolean; color: string }) => React.ReactNode;

export const Segmented = <T extends string>({
  options,
  selected,
  onSelect,
  chrome,
  compact,
  label,
  iconOnly,
}: {
  options: { value: T; label: string; icon?: SegmentIcon }[];
  selected: T;
  onSelect: (value: T) => void;
  chrome: QuranChromeColors;
  compact?: boolean;
  label?: string;
  // Drops the visible text, keeping it as each segment's accessibility label —
  // for narrow slots where a translated label would wrap.
  iconOnly?: boolean;
}) => (
  <XStack
    gap="$1"
    backgroundColor={chrome.cardBorder}
    borderRadius={10}
    padding={2}
    accessibilityRole="radiogroup"
    accessibilityLabel={label}>
    {options.map(({ value, label: optionLabel, icon }) => {
      const active = value === selected;
      // The active fill is the accent, so its contrast partner is the app
      // surface — white in light mode, near-black in dark.
      const textColor = active ? chrome.background : chrome.subtleText;
      return (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          accessibilityLabel={optionLabel}
          style={{ flex: 1 }}>
          <YStack
            minHeight={44}
            justifyContent="center"
            paddingHorizontal={compact ? "$2.5" : "$3.5"}
            paddingVertical={icon ? "$2" : "$1.5"}
            borderRadius={8}
            alignItems="center"
            gap={icon ? "$1.5" : undefined}
            backgroundColor={active ? chrome.accent : "transparent"}>
            {icon?.({ active, color: textColor })}
            {!iconOnly && (
              <Text
                fontSize={compact ? 12 : 13}
                fontWeight="600"
                color={textColor}
                numberOfLines={1}>
                {optionLabel}
              </Text>
            )}
          </YStack>
        </Pressable>
      );
    })}
  </XStack>
);

export const Stepper = ({
  icon: Icon,
  disabled,
  onPress,
  chrome,
  label,
}: {
  icon: typeof Minus;
  disabled: boolean;
  onPress: () => void;
  chrome: QuranChromeColors;
  label: string;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    hitSlop={8}
    style={{
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      opacity: disabled ? 0.35 : 1,
    }}>
    <Icon size={16} color={chrome.subtleText} />
  </Pressable>
);

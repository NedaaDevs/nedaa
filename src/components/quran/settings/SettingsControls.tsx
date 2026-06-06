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

export const SettingRow = ({
  label,
  chrome,
  children,
}: {
  label: string;
  chrome: QuranChromeColors;
  children: React.ReactNode;
}) => (
  <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$3" minHeight={44}>
    <Text fontSize={15} color={chrome.subtleText}>
      {label}
    </Text>
    {children}
  </XStack>
);

export const Segmented = <T extends string>({
  options,
  selected,
  onSelect,
  chrome,
  compact,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  chrome: QuranChromeColors;
  compact?: boolean;
}) => (
  <XStack gap="$1" backgroundColor={chrome.cardBorder} borderRadius={10} padding={2}>
    {options.map(({ value, label }) => {
      const active = value === selected;
      return (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          style={{ flex: 1 }}>
          <YStack
            paddingHorizontal={compact ? "$2.5" : "$3.5"}
            paddingVertical="$1.5"
            borderRadius={8}
            alignItems="center"
            backgroundColor={active ? chrome.accent : "transparent"}>
            <Text
              fontSize={compact ? 12 : 13}
              fontWeight="600"
              color={active ? "#fff" : chrome.subtleText}>
              {label}
            </Text>
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

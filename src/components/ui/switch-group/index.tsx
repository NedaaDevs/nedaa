import type { ReactNode } from "react";
import { View } from "react-native";

import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type Props = {
  label: string;
  /** Live state under the label, read with it. */
  summary?: string;
  hint?: string;
  icon?: IconProps["as"];
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Shown only while the switch is on. */
  children?: ReactNode;
};

/** A switch row that opens its body while on; a press on the row toggles. */
export const SwitchGroup = ({
  label,
  summary,
  hint,
  icon,
  value,
  onValueChange,
  children,
}: Props) => (
  <VStack>
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={summary ? `${label}, ${summary}` : label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      paddingVertical="$2">
      {icon ? <Icon as={icon} size="md" color="$muted" /> : null}
      <VStack flex={1}>
        <Text size="sm" bold color="$fg">
          {label}
        </Text>
        {summary ? (
          <Text size="xs" color="$muted">
            {summary}
          </Text>
        ) : null}
      </VStack>
      {/* The row is the control; the switch only draws its state. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Switch value={value} />
      </View>
    </Pressable>
    {value ? (
      <VStack gap="$3" paddingBottom="$3">
        {children}
      </VStack>
    ) : null}
  </VStack>
);

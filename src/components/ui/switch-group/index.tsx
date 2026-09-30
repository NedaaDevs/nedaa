import { createContext, use, type ReactNode } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { ICON_SIZES, type IconSize } from "@/components/ui/icon/sizing";
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
  /** While true the row reads busy and ignores presses. */
  busy?: boolean;
  onValueChange: (value: boolean) => void;
  /** Shown only while the switch is on. */
  children?: ReactNode;
};

const ICON_SIZE: IconSize = "md";
// The row and the body share this gap, so the body starts where the label does.
const ICON_GAP = "$3";

// True inside a group's body: a switch there is a setting, not a group.
const Nested = createContext(false);

/** A switch row that opens its body while on; a press on the row toggles. */
export const SwitchGroup = ({
  label,
  summary,
  hint,
  icon,
  value,
  busy = false,
  onValueChange,
  children,
}: Props) => {
  const nested = use(Nested);
  return (
    <VStack borderBottomWidth={nested ? undefined : 1} borderColor="$border">
      <Pressable
        onPress={() => onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityLabel={summary ? `${label}, ${summary}` : label}
        accessibilityHint={hint}
        accessibilityState={{ checked: value, busy, disabled: busy }}
        disabled={busy}
        flexDirection="row"
        alignItems="center"
        gap={ICON_GAP}
        paddingVertical="$2">
        {icon ? <Icon as={icon} size={ICON_SIZE} color="$muted" /> : null}
        <VStack flex={1}>
          <Text size="sm" bold={!nested} color="$fg">
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
        <HStack gap={ICON_GAP} paddingBottom="$3">
          {icon ? <View style={{ width: ICON_SIZES[ICON_SIZE] }} /> : null}
          <VStack flex={1} gap="$3">
            <Nested value>{children}</Nested>
          </VStack>
        </HStack>
      ) : null}
    </VStack>
  );
};

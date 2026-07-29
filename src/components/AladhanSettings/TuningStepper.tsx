import { FC } from "react";

// Components
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Minus, Plus } from "lucide-react-native";

// Config
import { TUNING_LIMIT, formatOffset } from "@/components/AladhanSettings/tuning";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/**
 * A bounded integer wants a stepper, not a 61-row picker. Row direction flips with the
 * layout, which keeps the minus on the logical start side without branching on RTL.
 *
 * The row is the adjustable: screen readers step it with their own increment/decrement
 * gesture, so the buttons stay out of the accessibility tree rather than announcing
 * themselves twice per prayer.
 */
export const TuningStepper: FC<Props> = ({ label, value, onChange, disabled = false }) => {
  const atMax = value >= TUNING_LIMIT;
  const atMin = value <= -TUNING_LIMIT;

  const step = (delta: number) => {
    const next = value + delta;
    if (next > TUNING_LIMIT || next < -TUNING_LIMIT) return;
    onChange(next);
  };

  return (
    <HStack
      testID="tuning-stepper"
      alignItems="center"
      justifyContent="space-between"
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: -TUNING_LIMIT, max: TUNING_LIMIT, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) =>
        step(nativeEvent.actionName === "increment" ? 1 : -1)
      }>
      <Text size="md" fontWeight="500" color="$typography" flex={1}>
        {label}
      </Text>

      <HStack alignItems="center" gap="$2">
        <Pressable
          testID="tuning-decrement"
          onPress={() => step(-1)}
          disabled={disabled || atMin}
          width={44}
          height={44}
          alignItems="center"
          justifyContent="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessibilityState={{ disabled: disabled || atMin }}>
          <Icon as={Minus} size={18} color={atMin ? "$typographySecondary" : "$accentPrimary"} />
        </Pressable>

        {/* Fixed width so the row does not jog as the digits change. */}
        <Text
          size="md"
          numeric
          fontWeight="600"
          color="$typography"
          textAlign="center"
          minWidth={44}>
          {formatOffset(value)}
        </Text>

        <Pressable
          testID="tuning-increment"
          onPress={() => step(1)}
          disabled={disabled || atMax}
          width={44}
          height={44}
          alignItems="center"
          justifyContent="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessibilityState={{ disabled: disabled || atMax }}>
          <Icon as={Plus} size={18} color={atMax ? "$typographySecondary" : "$accentPrimary"} />
        </Pressable>
      </HStack>
    </HStack>
  );
};

export default TuningStepper;

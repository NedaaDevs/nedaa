import { FC } from "react";

// Components
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Minus, Plus } from "lucide-react-native";

// Config
import { TUNING_LIMIT, formatOffset } from "@/components/AladhanSettings/tuning";

// Utils
import { formatNumberToLocale } from "@/utils/number";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/** The whole control is one adjustable; the buttons stay out of the a11y tree. */
export const TuningStepper: FC<Props> = ({ label, value, onChange, disabled = false }) => {
  const atMax = value >= TUNING_LIMIT;
  const atMin = value <= -TUNING_LIMIT;

  const step = (delta: number) => {
    const next = value + delta;
    if (next > TUNING_LIMIT || next < -TUNING_LIMIT) return;
    onChange(next);
  };

  return (
    <VStack
      testID="tuning-stepper"
      gap="$1"
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: -TUNING_LIMIT, max: TUNING_LIMIT, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) =>
        step(nativeEvent.actionName === "increment" ? 1 : -1)
      }>
      <Text size="md" fontWeight="500" color="$typography">
        {label}
      </Text>

      <HStack
        testID="tuning-controls"
        flexDirection="row"
        alignItems="center"
        gap="$2"
        alignSelf="flex-start">
        <Pressable
          testID="tuning-decrement"
          onPress={() => step(-1)}
          disabled={disabled || atMin}
          minWidth={44}
          minHeight={44}
          alignItems="center"
          justifyContent="center"
          hitSlop={8}
          accessible={false}
          accessibilityState={{ disabled: disabled || atMin }}>
          <Icon as={Minus} size="md" color={atMin ? "$typographySecondary" : "$accentPrimary"} />
        </Pressable>

        {/* Signed numbers stay LTR under an RTL layout. */}
        <Text
          size="md"
          numeric
          fontWeight="600"
          color="$typography"
          textAlign="center"
          minWidth={40}
          style={{ writingDirection: "ltr" }}>
          {formatNumberToLocale(formatOffset(value))}
        </Text>

        <Pressable
          testID="tuning-increment"
          onPress={() => step(1)}
          disabled={disabled || atMax}
          minWidth={44}
          minHeight={44}
          alignItems="center"
          justifyContent="center"
          hitSlop={8}
          accessible={false}
          accessibilityState={{ disabled: disabled || atMax }}>
          <Icon as={Plus} size="md" color={atMax ? "$typographySecondary" : "$accentPrimary"} />
        </Pressable>
      </HStack>
    </VStack>
  );
};

export default TuningStepper;

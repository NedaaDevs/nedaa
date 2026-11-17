import { StyleSheet, View } from "react-native";

import { CountFigure } from "@/components/athkar/looks/classic/CountFigure";
import { Box } from "@/components/ui/box";
import { type DigitTextProps } from "@/components/ui/digit-reserve";
import { Pressable } from "@/components/ui/pressable";
import { Ring, ringDiameter } from "@/components/ui/ring";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** Test ids for the ring's parts. */
export const COUNT_RING_PART = { DIGIT_SIZER: "count-ring-digit-sizer" } as const;

const SIZE = "lg";
const NUMBER: DigitTextProps = { size: "5xl", fontWeight: "600", color: "$fg", numeric: true };
const PRESSED_SCALE = 0.96;

type Props = {
  count: number;
  target: number;
  /** The count and the target as written, in the reader's digits. */
  countText: string;
  targetText: string;
  /** What a screen reader says for the value, such as "2 / 3". */
  valueText: string;
  /** Dims the ring: something else counts. */
  disabled: boolean;
  /** The count is settled: a press does nothing and the ring keeps its look. */
  held: boolean;
  /** The line under the ring. */
  hint: string;
  accessibilityLabel: string;
  onPress: () => void;
};

/** The count of the current dhikr, and the button that adds one. */
export const CountRing = ({
  count,
  target,
  countText,
  targetText,
  valueText,
  disabled,
  held,
  hint,
  accessibilityLabel,
  onPress,
}: Props) => {
  const diameter = ringDiameter(SIZE);
  return (
    <VStack alignItems="center" gap="$2">
      <Pressable
        width={diameter}
        height={diameter}
        borderRadius="$pill"
        backgroundColor="$pressed"
        alignItems="center"
        justifyContent="center"
        pressStyle={held ? undefined : { scale: PRESSED_SCALE }}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: valueText }}
        accessibilityState={{ disabled: disabled || held }}
        onPress={held ? undefined : onPress}>
        <View style={StyleSheet.absoluteFill}>
          <Ring progress={target > 0 ? count / target : 0} size={SIZE} color="$accent" />
        </View>
        <Box alignItems="center">
          <CountFigure
            countText={countText}
            targetText={targetText}
            textProps={NUMBER}
            digitTestID={COUNT_RING_PART.DIGIT_SIZER}
          />
        </Box>
      </Pressable>
      <Text size="helper" fontWeight="500" color="$muted" textAlign="center">
        {hint}
      </Text>
    </VStack>
  );
};

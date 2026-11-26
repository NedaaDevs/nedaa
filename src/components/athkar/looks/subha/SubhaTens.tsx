import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { SUBHA_TENS } from "@/constants/AthkarSubha";
import { tensOf } from "@/utils/subhaBeads";

/** Test ids for the dots' parts. */
export const SUBHA_TENS_PART = {
  DOT: "subha-tens-dot",
  LIT: "subha-tens-lit",
  RING: "subha-tens-ring",
} as const;

const RING_SIZE = SUBHA_TENS.SIZE + 2 * SUBHA_TENS.HOLD_RING;

type SubhaTensProps = {
  count: number;
  target: number;
  /** 0 to 1 as a hold builds; the next dot rings under it. */
  hold?: SharedValue<number>;
  reduceMotion: boolean;
};

/** One dot per round of a long count, lit as each round passes. */
export const SubhaTens = ({ count, target, hold, reduceMotion }: SubhaTensProps) => {
  const { dots, lit } = tensOf(count, target);
  const ring = useAnimatedStyle(() => ({ opacity: reduceMotion || !hold ? 0 : hold.get() }));
  if (dots === 0) return null;
  return (
    <HStack
      {...HIDDEN_FROM_READER}
      pointerEvents="none"
      alignSelf="center"
      justifyContent="center"
      gap="$1.5"
      marginTop="$3">
      {Array.from({ length: dots }, (_, index) => (
        <View key={index} style={styles.dot}>
          {index === lit && (
            <Animated.View testID={SUBHA_TENS_PART.RING} style={[styles.ring, ring]}>
              <Box flex={1} borderRadius="$pill" backgroundColor="$track" />
            </Animated.View>
          )}
          <Box
            testID={index < lit ? SUBHA_TENS_PART.LIT : SUBHA_TENS_PART.DOT}
            flex={1}
            borderRadius="$pill"
            backgroundColor={index < lit ? "$fg" : "$track"}
          />
        </View>
      ))}
    </HStack>
  );
};

const styles = StyleSheet.create({
  dot: { width: SUBHA_TENS.SIZE, height: SUBHA_TENS.SIZE },
  ring: {
    position: "absolute",
    top: -SUBHA_TENS.HOLD_RING,
    start: -SUBHA_TENS.HOLD_RING,
    width: RING_SIZE,
    height: RING_SIZE,
  },
});

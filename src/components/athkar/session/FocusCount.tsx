import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import { CountFigure } from "@/components/athkar/looks/classic/CountFigure";
import { useCountDrag } from "@/components/athkar/session/FocusStage";
import { Box } from "@/components/ui/box";
import { type DigitTextProps } from "@/components/ui/digit-reserve";
import { Text } from "@/components/ui/text";
import { FOCUS_MOTION } from "@/constants/AthkarFocus";
import type { FocusStage } from "@/hooks/useFocusStage";

const NUMBER: DigitTextProps = {
  fontSize: 56,
  lineHeight: 64,
  fontWeight: "600",
  color: "$fg",
  numeric: true,
};

type FocusCountProps = {
  stage: FocusStage;
  /** Test id of the box that reserves the widest count. */
  digitTestID: string;
};

/** The count in figures: a release's change, the number, its target. */
export const FocusCount = ({ stage, digitTestID }: FocusCountProps) => {
  const { gesture } = stage;
  const moved = useCountDrag({
    side: gesture.side,
    down: gesture.down,
    canUndo: stage.canUndo,
    reduceMotion: stage.reduceMotion,
  });
  return (
    <Animated.View style={[styles.count, moved]}>
      <Box minHeight="$6" justifyContent="flex-end">
        {stage.change !== null && (
          <Text size="label" fontWeight="600" color="$mutedSky" numeric>
            {stage.change}
          </Text>
        )}
      </Box>
      <CountFigure
        countText={stage.countText}
        targetText={stage.targetText}
        textProps={NUMBER}
        opacity={gesture.undoArmed ? FOCUS_MOTION.ARMED_OPACITY : 1}
        digitTestID={digitTestID}
      />
      <Text size="label" fontWeight="500" color="$mutedSky" numeric>
        {stage.targetLine}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  count: { alignItems: "center" },
});

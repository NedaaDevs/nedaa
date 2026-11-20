import { StyleSheet, View } from "react-native";

import { ClassicPositionMarks } from "@/components/athkar/looks/classic/ClassicPosition";
import { FocusOrbit } from "@/components/athkar/looks/classic/FocusOrbit";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FocusGestureMarks, FocusSideMarks } from "@/components/athkar/session/FocusHint";
import { FocusPager, FocusPlace, FocusSurface } from "@/components/athkar/session/FocusStage";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFocusStage } from "@/hooks/useFocusStage";

/** The Classic look of Focus: one dhikr, its count, a whole screen to touch. */
export const ClassicFocus = ({ period, close, audio, ...rules }: AthkarFocusProps) => {
  const stage = useFocusStage(rules);
  if (!stage) return null;
  const { session, count, target, gesture } = stage;

  return (
    <View style={styles.fill}>
      <HStack alignItems="center" paddingHorizontal="$3.5">
        {audio}
        <Text flex={1} size="label" fontWeight="600" color="$muted" textAlign="center">
          {period}
        </Text>
        {close}
      </HStack>
      <FocusSurface stage={stage}>
        <FocusPlace stage={stage}>
          <HStack minHeight="$7" alignItems="center" paddingHorizontal="$5">
            <ClassicPositionMarks
              marks={session.marks}
              figures={stage.figures}
              fraction={target > 0 ? count / target : 0}
            />
          </HStack>
        </FocusPlace>
        <Box minHeight="$6" paddingHorizontal="$5">
          {stage.hinting && <FocusSideMarks visible={stage.hintVisible} />}
        </Box>

        <FocusPager stage={stage} />

        <VStack alignItems="center" paddingHorizontal="$5" paddingBottom="$8">
          <FocusOrbit
            count={count}
            target={target}
            countText={stage.countText}
            targetText={stage.targetText}
            targetLine={stage.targetLine}
            change={stage.change}
            armed={gesture.undoArmed}
            canUndo={stage.canUndo}
            reduceMotion={stage.reduceMotion}
            hold={gesture.hold}
            side={gesture.side}
            down={gesture.down}
          />
          <Box minHeight="$6" marginTop="$3" justifyContent="center">
            {stage.statusLine !== null ? (
              <Text size="md" fontWeight="500" color="$muted" textAlign="center">
                {stage.statusLine}
              </Text>
            ) : (
              stage.hinting && <FocusGestureMarks visible={stage.hintVisible} />
            )}
          </Box>
        </VStack>
      </FocusSurface>
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });

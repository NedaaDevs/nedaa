import { StyleSheet, View } from "react-native";

import { SubhaKnots } from "@/components/athkar/looks/subha/SubhaKnots";
import { SubhaString } from "@/components/athkar/looks/subha/SubhaString";
import { SubhaTens } from "@/components/athkar/looks/subha/SubhaTens";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FocusCount } from "@/components/athkar/session/FocusCount";
import { FocusGestureMarks, FocusSideMarks } from "@/components/athkar/session/FocusHint";
import { FocusPager, FocusPlace, FocusSurface } from "@/components/athkar/session/FocusStage";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { SUBHA_STRING_KIND } from "@/constants/AthkarSubha";
import { useFocusStage } from "@/hooks/useFocusStage";

/** Test ids for the Focus stage's own parts. */
export const SUBHA_FOCUS_PART = {
  PLACE: "subha-focus-place",
  DIGIT_SIZER: "subha-focus-digit-sizer",
} as const;

/** The Subha look of Focus: the count slides beads along a hanging string. */
export const SubhaFocus = ({ period, close, audio, ...rules }: AthkarFocusProps) => {
  const stage = useFocusStage(rules);
  if (!stage) return null;
  const { session, count, target, gesture, reduceMotion } = stage;

  return (
    <View style={styles.fill}>
      <HStack alignItems="center" paddingHorizontal="$3.5">
        {audio}
        <Text flex={1} size="label" fontWeight="600" color="$mutedSky" textAlign="center">
          {period}
        </Text>
        {close}
      </HStack>
      <FocusSurface stage={stage}>
        <FocusPlace stage={stage} testID={SUBHA_FOCUS_PART.PLACE} style={styles.place}>
          <VStack gap="$1" alignItems="center">
            <SubhaKnots marks={session.marks} />
            <Text size="label" fontWeight="500" color="$mutedSky" numeric>
              {stage.figures}
            </Text>
          </VStack>
        </FocusPlace>
        <Box minHeight="$6" marginTop="$10" paddingHorizontal="$5">
          {stage.hinting && <FocusSideMarks visible={stage.hintVisible} />}
        </Box>

        <FocusPager stage={stage} />

        <VStack alignItems="center" paddingHorizontal="$5" paddingBottom="$8">
          <FocusCount stage={stage} digitTestID={SUBHA_FOCUS_PART.DIGIT_SIZER} />
          <VStack marginTop="$7">
            {/* Keyed: a new dhikr starts on a fresh string. */}
            <SubhaString
              key={session.current?.item.id}
              kind={SUBHA_STRING_KIND.FOCUS}
              count={count}
              target={target}
              reduceMotion={reduceMotion}
              hold={gesture.hold}
            />
          </VStack>
          <SubhaTens
            count={count}
            target={target}
            hold={gesture.hold}
            reduceMotion={reduceMotion}
          />
          <Box minHeight="$6" marginTop="$3" justifyContent="center">
            {stage.statusLine !== null ? (
              <Text size="md" fontWeight="500" color="$mutedSky" textAlign="center">
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  place: { position: "absolute", top: 0, start: 20, end: 20 },
});

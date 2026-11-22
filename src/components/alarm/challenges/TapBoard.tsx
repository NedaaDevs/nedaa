import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { BoardProps } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { BOARD_PART, BOARD_TYPE, TAP_PRESSES } from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { formatNumberToLocale } from "@/utils/number";
import { countsPress } from "@/utils/tapPress";

const TICKS = Array.from({ length: TAP_PRESSES }, (_, tick) => tick);

/** One large target pressed a set number of times, at any difficulty. */
const TapBoard = ({ onComplete }: BoardProps) => {
  const { t } = useTranslation();
  const press = usePressScale();
  const hapticLight = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const [done, setDone] = useState(0);
  // The last counted press; one sooner than the gap after it is a bounce.
  const lastCounted = useRef<number | null>(null);

  const handlePress = () => {
    const now = performance.now();
    if (done >= TAP_PRESSES) return;
    if (!countsPress(lastCounted.current, now)) return;
    lastCounted.current = now;
    const next = done + 1;
    setDone(next);
    if (next < TAP_PRESSES) {
      hapticLight();
      return;
    }
    hapticSuccess();
    onComplete();
  };

  const progress = t("alarm.task.tapCount", { done, total: TAP_PRESSES });
  const target = t("alarm.task.tapHere");

  return (
    <VStack flex={1} gap="$stack">
      <Text size="lg" fontWeight="500" color="$muted">
        {t("alarm.task.tapAsk", { count: TAP_PRESSES })}
      </Text>

      <VStack alignItems="center" gap="$2">
        <Text
          testID={BOARD_PART.TAP_COUNT}
          color="$fg"
          fontWeight="600"
          numeric
          fontSize={BOARD_TYPE.TAP_COUNT.fontSize}
          lineHeight={BOARD_TYPE.TAP_COUNT.lineHeight}>
          {progress}
        </Text>
        <HStack gap="$1.5" {...HIDDEN_FROM_READER}>
          {TICKS.map((tick) => (
            <Box
              key={tick}
              testID={BOARD_PART.TAP_TICK}
              width="$6"
              height="$2"
              borderRadius="$pill"
              borderWidth={1.5}
              borderColor="$fg"
              backgroundColor={tick < done ? "$fg" : undefined}
            />
          ))}
        </HStack>
      </VStack>

      <Pressable
        flex={1}
        minHeight="$24"
        alignItems="center"
        justifyContent="center"
        borderRadius="$hero"
        borderWidth={2}
        borderColor="$fg"
        backgroundColor="$surface"
        accessibilityLabel={target}
        transition={press.transition}
        animateOnly={press.animateOnly}
        pressStyle={{ ...press.pressStyle, opacity: 1, backgroundColor: "$pressed" }}
        onPress={handlePress}>
        <Text
          color="$fg"
          fontWeight="700"
          fontSize={BOARD_TYPE.TAP_TARGET.fontSize}
          lineHeight={BOARD_TYPE.TAP_TARGET.lineHeight}>
          {target}
        </Text>
      </Pressable>

      <SpokenStatus
        testID={BOARD_PART.TAP_STATUS}
        message={done > 0 && done < TAP_PRESSES ? formatNumberToLocale(String(done)) : null}
      />
    </VStack>
  );
};

export default TapBoard;

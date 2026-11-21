import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { QUIET_PHASE, TASK_SHELL_PART, type QuietPhase } from "@/constants/WakeTaskShell";
import { formatNumberToLocale } from "@/utils/number";
import { formatTimeRemaining } from "@/utils/timeRemaining";

type Props = { phase: QuietPhase; secondsLeft: number; fraction: number };

/** Where quiet time stands; the shell speaks its changes, so it is not live. */
const QuietStrip = ({ phase, secondsLeft, fraction }: Props) => {
  const { t } = useTranslation();
  const ending = phase === QUIET_PHASE.ENDING;
  const sounding = phase === QUIET_PHASE.SOUNDING;
  // The clock face and the spoken count carry the seconds.
  const state = sounding
    ? t("alarm.task.quiet.on")
    : ending
      ? t("alarm.task.quiet.soon")
      : t("alarm.task.quiet.paused");

  return (
    <HStack
      testID={TASK_SHELL_PART.QUIET_STRIP}
      accessible
      // The seconds are said as a count, not read off the clock face.
      accessibilityLabel={
        sounding ? undefined : t("a11y.alarm.task.quietLeft", { state, count: secondsLeft })
      }
      minHeight="$14"
      paddingVertical="$2"
      paddingHorizontal="$4"
      gap="$stack"
      alignItems="center"
      borderRadius="$card"
      borderWidth={ending || sounding ? 2.5 : 1.5}
      borderColor={ending ? "$accent" : sounding ? "$fg" : "$hairline"}
      backgroundColor="$surface">
      <Icon as={ending || sounding ? Volume2 : VolumeX} size="xl" color="$fg" />
      <VStack flex={1} gap="$1">
        <Text size="label" fontWeight="600" color="$fg">
          {state}
        </Text>
        {sounding ? (
          <Text size="md" fontWeight="500" color="$muted">
            {t("alarm.task.quiet.onHelp")}
          </Text>
        ) : (
          <Box height="$1" borderRadius="$pill" overflow="hidden" backgroundColor="$track">
            <Box
              testID={TASK_SHELL_PART.QUIET_FILL}
              height="100%"
              width={`${fraction * 100}%`}
              borderRadius="$pill"
              backgroundColor={ending ? "$accent" : "$fg"}
            />
          </Box>
        )}
      </VStack>
      {!sounding && (
        <Text size={ending ? "4xl" : "2xl"} fontWeight="600" color="$fg" numeric>
          {formatNumberToLocale(formatTimeRemaining(secondsLeft))}
        </Text>
      )}
    </HStack>
  );
};

export default QuietStrip;

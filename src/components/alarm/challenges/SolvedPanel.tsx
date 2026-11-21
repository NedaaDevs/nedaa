import { useEffect, useRef, useState } from "react";
import { View, type ViewInstance } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { RINGING_PART } from "@/constants/AlarmRinging";
import { TASK_ENTER_MS } from "@/constants/WakeTaskShell";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmPrayer } from "@/hooks/useAlarmPrayer";
import { useClockTime } from "@/hooks/useClockTime";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";

type Props = {
  alarmId: string;
  alarmType: ScheduledAlarmType;
  onClose: () => void;
};

/** After the last task: the alarm has stopped, and when its prayer began. */
const SolvedPanel = ({ alarmId, alarmType, onClose }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const clockTime = useClockTime();
  const { prayer, moment } = useAlarmPrayer(alarmId, alarmType);
  // An alarm can ring before its prayer, so the sentence reads from the solve.
  const [solvedAt] = useState(Date.now);
  const title = useRef<ViewInstance>(null);

  // The solved board held the reader's focus, so focus moves here.
  useEffect(() => focusOn(title.current), []);

  const time = moment && clockTime(moment.time, moment.timezone);
  const key =
    moment && moment.time.getTime() <= solvedAt ? "alarm.solved.began" : "alarm.solved.begins";
  const close = t("common.close");

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(TASK_ENTER_MS)}>
      <VStack
        testID={RINGING_PART.SOLVED}
        gap="$stack"
        padding="$group"
        borderRadius="$card"
        borderWidth={1.5}
        borderColor="$hairline"
        backgroundColor="$surface">
        <HStack gap="$stack" alignItems="center">
          <Box
            {...HIDDEN_FROM_READER}
            width="$10"
            height="$10"
            borderRadius="$pill"
            borderWidth={2}
            borderColor="$fg"
            alignItems="center"
            justifyContent="center">
            <Icon as={Check} size="xl" color="$fg" />
          </Box>
          <VStack flex={1} gap="$tight">
            <View ref={title} accessible accessibilityRole="header">
              <Text size="headline" bold color="$fg">
                {t("alarm.solved.title")}
              </Text>
            </View>
            {prayer && time ? (
              <Text
                size="lg"
                fontWeight="500"
                color="$muted"
                accessibilityLabel={t(key, { prayer, time: time.spoken })}>
                {t(key, { prayer, time: time.shown })}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        <Button size="lg" onPress={onClose} accessibilityLabel={close}>
          <Button.Text size="xl" fontWeight="600">
            {close}
          </Button.Text>
        </Button>
      </VStack>
    </Animated.View>
  );
};

export default SolvedPanel;

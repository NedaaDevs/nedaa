import type { Ref } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useHaptic } from "@/hooks/useHaptic";
import type { WakeTask } from "@/types/alarm";
import { describeStart, isNonEmpty } from "@/utils/taskRun";

type Props = {
  tasks: readonly WakeTask[];
  onStart: () => void;
  /** An alarm with no task stops at the press. */
  onStop: () => void;
  /** The main button, so a screen can move the reader's focus to it. */
  ref?: Ref<ViewInstance>;
};

/** The ringing screen's main button: it opens the task, or stops the alarm. */
const TaskStart = ({ tasks, onStart, onStop, ref }: Props) => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);

  if (!isNonEmpty(tasks)) {
    const stop = t("alarm.task.stop");
    return (
      <Button
        ref={ref}
        size="xl"
        width="100%"
        minHeight="$20"
        onPress={() => {
          hapticSuccess();
          onStop();
        }}
        accessibilityLabel={stop}>
        <Button.Text size="xl" fontWeight="700">
          {stop}
        </Button.Text>
      </Button>
    );
  }

  const start = describeStart(tasks, t);
  return (
    <VStack gap="$stack" width="100%">
      <Button
        ref={ref}
        size="xl"
        width="100%"
        minHeight="$20"
        onPress={onStart}
        accessibilityLabel={start.label}>
        <VStack alignItems="center" gap="$0.5">
          <Button.Text size="xl" fontWeight="700">
            {start.title}
          </Button.Text>
          {start.detail && (
            <Button.Text size="md" fontWeight="500">
              {start.detail}
            </Button.Text>
          )}
        </VStack>
      </Button>
      <Text size="label" fontWeight="500" color="$muted" textAlign="center">
        {t("alarm.task.startHint")}
      </Text>
    </VStack>
  );
};

export default TaskStart;

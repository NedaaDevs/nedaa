import { useState } from "react";
import { ScrollView } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TaskShell } from "@/components/alarm/challenges";
import { Background } from "@/components/ui/background";
import { BrightnessTheme } from "@/components/ui/brightness-theme";
import { Button } from "@/components/ui/button";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ALARM_TYPE, alarmSettingsHref } from "@/constants/Alarm";
import { PRESENTATION } from "@/constants/Navigation";
import { WAKE_TASK_IDS, WAKE_TASK_OPTIONS, type WakeTaskId } from "@/constants/WakeTask";
import {
  TASK_SHELL_MODE,
  TASK_TRIAL_ALL,
  TASK_TRIAL_PARAM,
  WAKE_TASK_DIFFICULTY_KEY,
} from "@/constants/WakeTaskShell";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { usePersistHydrated } from "@/hooks/usePersistHydrated";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType, WakeTask } from "@/types/alarm";
import { formatNumberToLocale } from "@/utils/number";
import { difficultyOf, isNonEmpty, stepsOf, taskName } from "@/utils/taskRun";
import { addWakeTask, canAddWakeTask, wakeTaskFor } from "@/utils/wakeTasks";

type TrialParams = Partial<
  Record<(typeof TASK_TRIAL_PARAM)[keyof typeof TASK_TRIAL_PARAM], string>
>;

/** The tasks a trial link names: one task, or the alarm's whole stack. */
const trialTasks = (stack: readonly WakeTask[], task: string | undefined): WakeTask[] => {
  if (task === TASK_TRIAL_ALL) return [...stack];
  const id = WAKE_TASK_IDS.find((known) => known === task);
  return id ? [wakeTaskFor(stack, id)] : [];
};

/** A task with the options its board offers, as shown and as spoken. */
const describeOptions = (task: WakeTask, t: TFunction): { shown: string; spoken: string } => {
  const { hasDifficulty, hasSteps } = WAKE_TASK_OPTIONS[task.id];
  const name = taskName(task, t);
  const difficulty = t(WAKE_TASK_DIFFICULTY_KEY[difficultyOf(task)]);
  const shown = hasDifficulty ? t("alarm.task.withDifficulty", { name, difficulty }) : name;
  const spoken = hasDifficulty ? t("a11y.join", { first: name, second: difficulty }) : name;
  if (!hasSteps) return { shown, spoken };
  const count = stepsOf(task);
  return {
    shown: formatNumberToLocale(t("alarm.task.withSteps", { name: shown, count })),
    spoken: t("a11y.alarm.task.withSteps", { name: spoken, count }),
  };
};

type TrialProps = { alarmType: AlarmType; task: string | undefined };

/** The run itself, mounted once the saved stack has loaded. */
const Trial = ({ alarmType, task }: TrialProps) => {
  const { t } = useTranslation();
  const { settings, update } = useAlarmTypeSettings(alarmType);
  const [tasks] = useState(() => trialTasks(settings.tasks, task));
  const [finished, setFinished] = useState(false);
  const done = t("alarm.task.trial.done");
  const back = t("alarm.task.trial.backToList");
  const use = t("alarm.task.trial.use");

  // A cold link has nothing under it to go back to.
  const leave = () =>
    router.canGoBack() ? router.back() : router.replace(alarmSettingsHref(alarmType));

  const [tried] = tasks;
  const single: WakeTaskId | null = task !== TASK_TRIAL_ALL && tried ? tried.id : null;
  const addable =
    finished && single !== null && canAddWakeTask(settings.tasks, single) ? single : null;
  const options = finished && tried && single !== null ? describeOptions(tried, t) : null;

  // The person's press, not the trial, changes the saved stack.
  const addTried = (id: WakeTaskId) => {
    update({ tasks: addWakeTask(settings.tasks, id) });
    leave();
  };

  if (isNonEmpty(tasks) && !finished) {
    return (
      <VStack flex={1} paddingVertical="$section">
        <TaskShell
          mode={TASK_SHELL_MODE.TRIAL}
          tasks={tasks}
          onComplete={() => setFinished(true)}
          onBack={leave}
        />
      </VStack>
    );
  }

  return (
    <VStack flex={1} justifyContent="center" gap="$section">
      {finished ? (
        <VStack gap="$inline">
          <Text size="heading" bold color="$fg" accessibilityRole="header">
            {done}
          </Text>
          {options ? (
            <Text size="md" color="$muted" accessibilityLabel={options.spoken}>
              {options.shown}
            </Text>
          ) : null}
        </VStack>
      ) : null}
      <VStack gap="$stack">
        {addable ? (
          <Button
            size="lg"
            onPress={() => addTried(addable)}
            accessibilityLabel={use}
            accessibilityHint={t("a11y.alarm.task.trial.useHint")}>
            <Button.Text>{use}</Button.Text>
          </Button>
        ) : null}
        <Button size="lg" variant="outline" onPress={leave} accessibilityLabel={back}>
          <Button.Text>{back}</Button.Text>
        </Button>
      </VStack>
      <SpokenStatus message={finished ? done : null} />
    </VStack>
  );
};

// A silent run from the picker; only a press of "Use this task" writes.
export default function AlarmTrialRoute() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<TrialParams>();
  const hydrated = usePersistHydrated(useAlarmSettingsStore.persist);
  const alarmType =
    Object.values(ALARM_TYPE).find((type) => type === params[TASK_TRIAL_PARAM.ALARM_TYPE]) ??
    ALARM_TYPE.FAJR;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, presentation: PRESENTATION.FULL_SCREEN_MODAL }}
      />
      <BrightnessTheme dark>
        <StatusBar style="light" />
        <Background>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets>
            <VStack
              flex={1}
              paddingTop={insets.top}
              paddingBottom={insets.bottom}
              paddingHorizontal="$screen">
              {hydrated ? (
                <Trial alarmType={alarmType} task={params[TASK_TRIAL_PARAM.TASK]} />
              ) : null}
            </VStack>
          </ScrollView>
        </Background>
      </BrightnessTheme>
    </>
  );
}

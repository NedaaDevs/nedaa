import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import EmergencyQuiet from "@/components/alarm/challenges/EmergencyQuiet";
import QuietBanner from "@/components/alarm/challenges/QuietBanner";
import QuietStrip from "@/components/alarm/challenges/QuietStrip";
import { REVIEWED_BOARDS, TASK_BOARDS, type Board } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { BackLink } from "@/components/ui/screen-header/back-link";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  HANDOVER_MS,
  QUIET_ENDING_SECONDS,
  QUIET_PHASE,
  TASK_ENTER_MS,
  TASK_EXIT_MS,
  TASK_RUN_NEXT,
  TASK_SHELL_MODE,
  TASK_SHELL_PART,
} from "@/constants/WakeTaskShell";
import type { EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useHaptic } from "@/hooks/useHaptic";
import { useQuietOffer } from "@/hooks/useQuietOffer";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useTaskClock } from "@/hooks/useTaskClock";
import {
  advanceTaskRun,
  difficultyOf,
  resumePosition,
  stepsOf,
  taskName,
  type NonEmptyTasks,
  type TaskDraws,
  type TaskPosition,
  type TaskRunSnapshot,
} from "@/utils/taskRun";
import { quietSecondsFor } from "@/utils/taskClock";

const SECOND_MS = 1000;

type AlarmRun = {
  mode?: typeof TASK_SHELL_MODE.ALARM;
  tasks: NonEmptyTasks;
  /** When the person opened the task, in epoch ms. */
  openedAt: number;
  /** The run a Back saved; it resumes where it was left. */
  resume?: TaskRunSnapshot;
  /** False while the alarm cannot sound, e.g. snoozed. */
  audible: boolean;
  onComplete: () => void;
  /** The way out: the alarm stops with its task unfinished. */
  onStop: () => void;
  onBack: (saved: TaskRunSnapshot) => void;
  onQuietStart: () => void;
  onQuietEnd: () => void;
  emergency?: EmergencyQuietControl;
  /** Takes the strip's place once the last task is solved. */
  solved: ReactNode;
};

/** A silent run from the picker: no quiet time, no way out, no saved state. */
type TrialRun = {
  mode: typeof TASK_SHELL_MODE.TRIAL;
  tasks: NonEmptyTasks;
  /** Runs every board as reviewed, e.g. a dhikr list still under review. */
  reviewed?: boolean;
  onComplete: () => void;
  onBack: () => void;
};

type Props = AlarmRun | TrialRun;

const noop = () => {};

/** Runs the stack's boards in order, each its steps' times; an alarm's run
 *  in quiet time, a trial's in silence. */
const TaskShell = (props: Props) => {
  const { tasks, onComplete } = props;
  const alarm = props.mode === TASK_SHELL_MODE.TRIAL ? null : props;
  // The alarm's last task is solved; the alarm has stopped.
  const [done, setDone] = useState(false);
  const audible = !done && (alarm?.audible ?? false);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const hapticWarning = useHaptic(HAPTIC_FEEDBACK.WARNING);
  const quietSeconds = quietSecondsFor(screenReader);
  // A trial's clock never sounds, so it shows no strip and earns no way out.
  const [trialOpenedAt] = useState(Date.now);
  const quiet = useTaskClock({
    openedAt: alarm?.openedAt ?? trialOpenedAt,
    resume: alarm?.resume?.clock,
    quietMs: quietSeconds * SECOND_MS,
    audible,
    stepped: reduceMotion,
    onQuietStart: alarm?.onQuietStart ?? noop,
    onQuietEnding: hapticWarning,
    onQuietEnd: alarm?.onQuietEnd ?? noop,
  });

  const [position, setPosition] = useState<TaskPosition>(() =>
    resumePosition(tasks, alarm?.resume?.position)
  );
  // Each board, a repeat of the same one included, mounts fresh.
  const [round, setRound] = useState(0);
  // The task the handover panel leads to; no board takes a tap meanwhile.
  const [handover, setHandover] = useState<TaskPosition | null>(null);
  const [drawn, setDrawn] = useState<TaskDraws>(alarm?.resume?.drawn ?? {});

  const finishHandover = useEffectEvent((next: TaskPosition) => {
    setHandover(null);
    setPosition(next);
    setRound((count) => count + 1);
    quiet.restartQuiet();
  });

  useEffect(() => {
    if (!handover) return;
    const id = setTimeout(() => finishHandover(handover), HANDOVER_MS.IN + HANDOVER_MS.HOLD);
    return () => clearTimeout(id);
  }, [handover]);

  const handleSolved = () => {
    if (done) return;
    const result = advanceTaskRun(tasks, position);
    if (result.next === TASK_RUN_NEXT.DONE) {
      if (alarm) setDone(true);
      onComplete();
      return;
    }
    quiet.restartQuiet();
    if (result.next === TASK_RUN_NEXT.HANDOVER) {
      setHandover(result.position);
      return;
    }
    setPosition(result.position);
    setRound((count) => count + 1);
  };

  // A solved board's handover leads to the next task, so Back keeps that.
  const handleBack = () => {
    if (props.mode === TASK_SHELL_MODE.TRIAL) props.onBack();
    else props.onBack({ clock: quiet.leave(), position: handover ?? position, drawn });
  };

  const task = tasks[position.task];
  const boards =
    props.mode === TASK_SHELL_MODE.TRIAL && props.reviewed ? REVIEWED_BOARDS : TASK_BOARDS;
  const board: Board = boards[task.id];
  const draw = (item: number) =>
    setDrawn((memory) => ({ ...memory, [task.id]: [...(memory[task.id] ?? []), item] }));
  const steps = stepsOf(task);
  const taskLine =
    tasks.length > 1
      ? t("alarm.task.taskOf", { task: position.task + 1, total: tasks.length })
      : null;
  const stepLine =
    steps > 1 ? t("alarm.task.stepOf", { step: position.step + 1, total: steps }) : null;

  const nextTask = handover && tasks[handover.task];
  const handoverPosition =
    handover && t("alarm.task.taskOf", { task: handover.task + 1, total: tasks.length });
  const handoverNext = nextTask && t("alarm.task.next", { name: taskName(nextTask, t) });

  const opening = position.step > 0 && !done ? stepLine : null;
  // Every step is done once the alarm has stopped.
  const current = done ? steps : position.step;
  const progressStatus =
    handoverPosition && handoverNext
      ? t("a11y.alarm.task.handover", { position: handoverPosition, next: handoverNext })
      : board.saysOpening
        ? null
        : opening;
  const quietStatus = !audible
    ? null
    : quiet.phase === QUIET_PHASE.ENDING
      ? t("alarm.task.quiet.ending", { count: QUIET_ENDING_SECONDS })
      : quiet.phase === QUIET_PHASE.SOUNDING
        ? t("alarm.task.quiet.on")
        : null;

  const backName = alarm ? t("alarm.task.back") : t("alarm.task.trial.back");
  const backLabel = alarm
    ? t("a11y.backTo", { screen: backName })
    : t("alarm.task.trial.backToList");
  const stop = t("alarm.task.stop");
  const onStop = alarm && quiet.wayOut && !done ? alarm.onStop : null;
  const emergency = alarm?.emergency;
  const quietUntil = emergency?.quietUntil ?? null;
  // The confirm stands in the strip's place; the way out takes it away.
  const quietOffer = useQuietOffer(emergency, quiet.wayOut);

  return (
    <VStack flex={1} gap="$stack">
      <HStack alignItems="flex-start" justifyContent="space-between" gap="$stack">
        {done ? <Box /> : <BackLink onPress={handleBack} label={backLabel} name={backName} />}
        {!handover && (taskLine || stepLine) && (
          <VStack flexShrink={1} alignItems="flex-end" gap="$1.5">
            {taskLine && (
              <Text size="md" fontWeight="600" color="$muted">
                {taskLine}
              </Text>
            )}
            {stepLine && (
              <Text size="lg" fontWeight="600" color="$fg">
                {stepLine}
              </Text>
            )}
            {stepLine && (
              <HStack
                flexWrap="wrap"
                justifyContent="flex-end"
                gap="$1.5"
                alignItems="center"
                {...HIDDEN_FROM_READER}>
                {Array.from({ length: steps }, (_, step) => (
                  <Box
                    key={step}
                    testID={TASK_SHELL_PART.PIP}
                    width="$6"
                    height={step === current ? "$2" : "$1.5"}
                    borderRadius="$pill"
                    borderWidth={step > current ? 1.5 : 0}
                    borderColor="$fg"
                    backgroundColor={
                      step < current ? "$fg" : step === current ? "$accent" : undefined
                    }
                  />
                ))}
              </HStack>
            )}
          </VStack>
        )}
      </HStack>

      {quietUntil !== null && !done && <QuietBanner until={quietUntil} />}

      {!handover && (
        <Text size="heading" bold color="$fg" accessibilityRole="header" marginTop="$2">
          {t(board.titleKey)}
        </Text>
      )}

      <VStack flex={1} justifyContent="center" gap="$stack">
        {handover ? (
          <Animated.View
            key={TASK_SHELL_PART.HANDOVER}
            style={styles.fill}
            entering={reduceMotion ? undefined : FadeIn.duration(HANDOVER_MS.IN)}
            exiting={reduceMotion ? undefined : FadeOut.duration(HANDOVER_MS.OUT)}>
            <VStack
              testID={TASK_SHELL_PART.HANDOVER}
              flex={1}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              padding="$section"
              borderRadius="$hero"
              borderWidth={1.5}
              borderColor="$hairline"
              backgroundColor="$surface">
              <Text size="lg" fontWeight="600" color="$muted" textAlign="center">
                {handoverPosition}
              </Text>
              <Text size="heading" bold color="$fg" textAlign="center">
                {handoverNext}
              </Text>
            </VStack>
          </Animated.View>
        ) : (
          <Animated.View
            key={round}
            style={styles.board}
            pointerEvents={done ? "none" : "auto"}
            {...(done ? HIDDEN_FROM_READER : null)}
            entering={reduceMotion ? undefined : FadeInDown.duration(TASK_ENTER_MS)}
            exiting={reduceMotion ? undefined : FadeOut.duration(TASK_EXIT_MS)}>
            <board.Component
              difficulty={difficultyOf(task)}
              onComplete={handleSolved}
              opening={board.saysOpening ? opening : null}
              drawn={drawn[task.id]}
              onDraw={draw}
            />
          </Animated.View>
        )}
      </VStack>

      <VStack gap="$stack">
        {onStop && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(TASK_ENTER_MS)}>
            <VStack gap="$2">
              <Text size="label" fontWeight="500" color="$muted" textAlign="center">
                {t("alarm.task.wayOut")}
              </Text>
              <Button
                size="lg"
                action="default"
                variant="outline"
                borderWidth={2}
                borderColor="$fg"
                onPress={onStop}
                accessibilityLabel={stop}>
                <Button.Text size="xl" fontWeight="600" color="$fg">
                  {stop}
                </Button.Text>
              </Button>
            </VStack>
          </Animated.View>
        )}
        {alarm && done ? (
          alarm.solved
        ) : alarm ? (
          <>
            {audible && !quietOffer.confirmOpen && (
              <QuietStrip
                phase={quiet.phase}
                secondsLeft={quiet.secondsLeft}
                fraction={quiet.fraction}
              />
            )}
            {emergency && <EmergencyQuiet control={emergency} offer={quietOffer} />}
          </>
        ) : (
          <HStack
            testID={TASK_SHELL_PART.TRIAL_STRIP}
            alignItems="center"
            justifyContent="center"
            flexWrap="wrap"
            gap="$inline"
            padding="$stack"
            borderRadius="$card"
            borderWidth={1.5}
            borderStyle="dashed"
            borderColor="$hairline">
            <Text size="label" bold color="$fg">
              {t("alarm.task.trial.tag")}
            </Text>
            <Text size="label" color="$muted">
              {t("alarm.task.trial.help")}
            </Text>
          </HStack>
        )}
      </VStack>

      <SpokenStatus testID={TASK_SHELL_PART.QUIET_STATUS} message={quietStatus} />
      <SpokenStatus testID={TASK_SHELL_PART.PROGRESS_STATUS} message={progressStatus} />
      <SpokenStatus
        testID={TASK_SHELL_PART.WAY_OUT_STATUS}
        message={onStop ? t("alarm.task.wayOut") : null}
      />
    </VStack>
  );
};

// A board fills the area; one shorter than it sits in the middle.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  board: { flex: 1, justifyContent: "center" },
});

export default TaskShell;

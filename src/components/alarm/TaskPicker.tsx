import { useEffect, useRef, useState, type Ref } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { SpokenStatus } from "@/components/ui/live-region";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Stepper } from "@/components/ui/stepper";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_MAX_STEPS,
  WAKE_TASK_MIN_STEPS,
  WAKE_TASK_MOVE,
  WAKE_TASK_OPTIONS,
  type WakeTaskId,
  type WakeTaskMove,
} from "@/constants/WakeTask";
import { TAP_PRESSES } from "@/constants/WakeTaskBoards";
import {
  TASK_PICKER_PART,
  TASK_TRIAL_ALL,
  WAKE_TASK_ABOUT_KEY,
  WAKE_TASK_DIFFICULTY_KEY,
  WAKE_TASK_NAME_KEY,
} from "@/constants/WakeTaskShell";
import { useHaptic } from "@/hooks/useHaptic";
import { CHALLENGE_DIFFICULTIES, type WakeTask } from "@/types/alarm";
import { focusOn } from "@/utils/accessibilityFocus";
import { formatNumberToLocale } from "@/utils/number";
import { wayOutSentence } from "@/utils/taskClock";
import { difficultyOf, stepsOf } from "@/utils/taskRun";
import {
  addWakeTask,
  canAddWakeTask,
  changeWakeTask,
  moveWakeTask,
  removeWakeTask,
  type WakeTaskOptionChange,
} from "@/utils/wakeTasks";

const DIMMED = 0.4;
const MARK_EDGE = 1.5;

/** What a trial runs: one task, or the stack in order. */
export type TaskTrialTarget = WakeTaskId | typeof TASK_TRIAL_ALL;

type Props = {
  tasks: readonly WakeTask[];
  onChange: (tasks: WakeTask[]) => void;
  onTry: (target: TaskTrialTarget) => void;
};

type MarkProps = { chosen: boolean; place: number | null; full: boolean };

/** A check, or a place in the stack; a dashed ring when no more fit. */
const TaskMark = ({ chosen, place, full }: MarkProps) => (
  <Box
    {...HIDDEN_FROM_READER}
    testID={TASK_PICKER_PART.MARK}
    width="$6"
    height="$6"
    borderRadius="$pill"
    borderWidth={MARK_EDGE}
    borderStyle={full && !chosen ? "dashed" : "solid"}
    borderColor={chosen ? "$accent" : full ? "$hairline" : "$muted"}
    backgroundColor={chosen ? "$accent" : "transparent"}
    alignItems="center"
    justifyContent="center">
    {chosen && place === null ? <Icon as={Check} size="sm" color="$bg" /> : null}
    {chosen && place !== null ? (
      <Text size="xs" fontWeight="700" color="$bg" numeric>
        {formatNumberToLocale(String(place))}
      </Text>
    ) : null}
  </Box>
);

type MoveProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
  up: boolean;
  ref: Ref<ViewInstance>;
};

const MoveButton = ({ label, disabled, onPress, up, ref }: MoveProps) => (
  <Pressable
    ref={ref}
    onPress={disabled ? undefined : onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    width="$target"
    height="$target"
    borderRadius="$control"
    borderWidth={1}
    borderColor="$border"
    backgroundColor="$surface2"
    opacity={disabled ? DIMMED : 1}
    alignItems="center"
    justifyContent="center">
    <Icon as={up ? ChevronUp : ChevronDown} size="md" color="$fg" />
  </Pressable>
);

/** The alarm's wake-up tasks: which, in what order, and each one's options. */
const TaskPicker = ({ tasks, onChange, onTry }: Props) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const [moved, setMoved] = useState<string | null>(null);
  const moveButtons = useRef(new Map<string, ViewInstance | null>());
  const pendingFocus = useRef<string | null>(null);
  const full = tasks.length >= WAKE_TASK_MAX_STACK;
  const chosenIds = tasks.map((task) => task.id);
  const shownIds = [...chosenIds, ...WAKE_TASK_IDS.filter((id) => !chosenIds.includes(id))];

  // A moved row is a moved native view; the reader's focus goes back to it.
  useEffect(() => {
    const key = pendingFocus.current;
    pendingFocus.current = null;
    if (key) focusOn(moveButtons.current.get(key));
  }, [tasks]);

  const moveKey = (id: WakeTaskId, direction: WakeTaskMove) => `${id}.${direction}`;
  const moveRef = (key: string) => (node: ViewInstance | null) => {
    moveButtons.current.set(key, node);
  };

  const edit = (next: WakeTask[]) => {
    hapticSelection();
    onChange(next);
  };

  const placeText = (index: number) =>
    t("alarm.task.taskOf", { task: index + 1, total: tasks.length });

  const move = (task: WakeTask, direction: WakeTaskMove) => {
    const next = moveWakeTask(tasks, task.id, direction);
    const index = next.findIndex((entry) => entry.id === task.id);
    setMoved(t("a11y.join", { first: t(WAKE_TASK_NAME_KEY[task.id]), second: placeText(index) }));
    pendingFocus.current = moveKey(task.id, direction);
    edit(next);
  };

  const change = (id: WakeTaskId, option: WakeTaskOptionChange) =>
    edit(changeWakeTask(tasks, id, option));

  const options = (task: WakeTask, index: number) => {
    const name = t(WAKE_TASK_NAME_KEY[task.id]);
    const offered = WAKE_TASK_OPTIONS[task.id];
    const steps = stepsOf(task);
    return (
      <VStack gap="$stack" paddingStart="$9" paddingBottom="$stack">
        {tasks.length > 1 ? (
          <HStack alignItems="center" justifyContent="space-between" gap="$inline">
            <Text size="sm" color="$muted" flexShrink={1}>
              {formatNumberToLocale(placeText(index))}
            </Text>
            <HStack gap="$inline">
              <MoveButton
                up
                ref={moveRef(moveKey(task.id, WAKE_TASK_MOVE.UP))}
                label={t("a11y.alarm.task.moveUp", { name })}
                disabled={index === 0}
                onPress={() => move(task, WAKE_TASK_MOVE.UP)}
              />
              <MoveButton
                up={false}
                ref={moveRef(moveKey(task.id, WAKE_TASK_MOVE.DOWN))}
                label={t("a11y.alarm.task.moveDown", { name })}
                disabled={index === tasks.length - 1}
                onPress={() => move(task, WAKE_TASK_MOVE.DOWN)}
              />
            </HStack>
          </HStack>
        ) : null}
        {offered.hasDifficulty ? (
          <VStack gap="$inline">
            <Text size="sm" color="$muted">
              {t("alarm.challenge.difficulty")}
            </Text>
            <SegmentedChoice
              options={CHALLENGE_DIFFICULTIES}
              value={difficultyOf(task)}
              onChange={(difficulty) => change(task.id, { difficulty })}
              accessibilityLabel={t("a11y.join", {
                first: name,
                second: t("alarm.challenge.difficulty"),
              })}
              label={(difficulty) => t(WAKE_TASK_DIFFICULTY_KEY[difficulty])}
            />
          </VStack>
        ) : null}
        {offered.hasSteps ? (
          <VStack gap="$inline">
            <Text size="sm" color="$muted">
              {t("alarm.task.steps")}
            </Text>
            <Stepper
              value={steps}
              onChange={(next) => change(task.id, { steps: next })}
              min={WAKE_TASK_MIN_STEPS}
              max={WAKE_TASK_MAX_STEPS}
              accessibilityLabel={t("a11y.join", { first: name, second: t("alarm.task.steps") })}
              valueText={formatNumberToLocale(t("a11y.alarm.task.steps", { count: steps }))}>
              <Text size="lg" fontWeight="600" color="$fg" numeric>
                {formatNumberToLocale(String(steps))}
              </Text>
            </Stepper>
          </VStack>
        ) : null}
      </VStack>
    );
  };

  const row = (id: WakeTaskId) => {
    const index = tasks.findIndex((task) => task.id === id);
    const task = tasks[index];
    const chosen = task !== undefined;
    const blocked = !chosen && !canAddWakeTask(tasks, id);
    const name = t(WAKE_TASK_NAME_KEY[id]);
    const about = blocked
      ? t("alarm.task.full", { count: WAKE_TASK_MAX_STACK })
      : t(WAKE_TASK_ABOUT_KEY[id], { count: TAP_PRESSES });
    const shownAbout = formatNumberToLocale(about);
    return (
      <VStack key={id}>
        <HStack alignItems="center" gap="$stack" minHeight="$14">
          <Pressable
            flex={1}
            flexDirection="row"
            alignItems="center"
            gap="$stack"
            minHeight="$target"
            onPress={
              blocked
                ? undefined
                : () => edit(chosen ? removeWakeTask(tasks, id) : addWakeTask(tasks, id))
            }
            accessibilityRole="checkbox"
            accessibilityLabel={t("a11y.sentences", { first: name, second: shownAbout })}
            accessibilityState={{ checked: chosen, disabled: blocked }}
            {...(chosen && tasks.length > 1 && { accessibilityValue: { text: placeText(index) } })}>
            <TaskMark chosen={chosen} place={tasks.length > 1 ? index + 1 : null} full={full} />
            <VStack flex={1} opacity={blocked ? DIMMED : 1}>
              <Text size="md" fontWeight="600" color="$fg">
                {name}
              </Text>
              <Text size="sm" color="$muted">
                {shownAbout}
              </Text>
            </VStack>
          </Pressable>
          <Pressable
            onPress={() => onTry(id)}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.alarm.task.try", { name })}
            accessibilityHint={t("a11y.alarm.task.tryHint")}
            minWidth="$target"
            minHeight="$target"
            paddingHorizontal="$stack"
            borderRadius="$control"
            borderWidth={1}
            borderColor="$border"
            alignItems="center"
            justifyContent="center">
            <Text size="sm" fontWeight="600" color="$accent">
              {t("alarm.task.try")}
            </Text>
          </Pressable>
        </HStack>
        {chosen ? options(task, index) : null}
      </VStack>
    );
  };

  const none = t("alarm.task.none");
  const noneAbout = t("alarm.task.about.none");

  return (
    <VStack gap="$stack">
      <VStack>
        <Pressable
          flexDirection="row"
          alignItems="center"
          gap="$stack"
          minHeight="$14"
          onPress={tasks.length === 0 ? undefined : () => edit([])}
          accessibilityRole="checkbox"
          accessibilityLabel={t("a11y.sentences", { first: none, second: noneAbout })}
          accessibilityState={{ checked: tasks.length === 0 }}>
          <TaskMark chosen={tasks.length === 0} place={null} full={false} />
          <VStack flex={1}>
            <Text size="md" fontWeight="600" color="$fg">
              {none}
            </Text>
            <Text size="sm" color="$muted">
              {noneAbout}
            </Text>
          </VStack>
        </Pressable>
        {shownIds.map((id) => (
          <VStack key={id}>
            <Divider />
            {row(id)}
          </VStack>
        ))}
      </VStack>
      {tasks.length > 1 ? (
        <Button
          variant="outline"
          onPress={() => onTry(TASK_TRIAL_ALL)}
          accessibilityLabel={t("alarm.task.tryAll")}
          accessibilityHint={t("a11y.alarm.task.tryAllHint")}>
          <Button.Text>{t("alarm.task.tryAll")}</Button.Text>
        </Button>
      ) : null}
      {tasks.length > 0 ? (
        <Text size="sm" color="$muted">
          {formatNumberToLocale(wayOutSentence(t))}
        </Text>
      ) : null}
      <SpokenStatus message={moved} testID={TASK_PICKER_PART.STATUS} />
    </VStack>
  );
};

export default TaskPicker;

import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Check, Circle, Hourglass, Info } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  PROGRESS_ROW,
  UPDATE_START,
  UPDATE_STEP,
  type ProgressRow,
  type UpdateStep,
} from "@/constants/Location";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import type { UpdateRun, UpdateStart } from "@/stores/locationUpdate";

/** Test ids for the parts a test reaches. */
export const LOCATION_UPDATE_PART = {
  FRAME: "location-update-frame",
  STEPS: "location-update-steps",
  MARK: "location-update-mark",
} as const;

/** The place step's line: a device read is still finding the city. */
const PLACE_STATUS: Record<UpdateStart["kind"], ParseKeys> = {
  [UPDATE_START.DEVICE]: "onboarding.fetch.locatingDevice",
  [UPDATE_START.ADOPT_DEVICE]: "onboarding.fetch.locatingDevice",
  [UPDATE_START.CITY]: "location.update.step.city",
};

/** The line naming what runs now, read aloud as it changes. */
const statusOf = ({ start, step }: UpdateRun): ParseKeys => {
  switch (step) {
    case UPDATE_STEP.LOCATION:
      return PLACE_STATUS[start.kind];
    case UPDATE_STEP.PRAYER_TIMES:
      return "location.update.step.prayerTimes";
    case UPDATE_STEP.NOTIFICATIONS:
      return "location.update.step.notifications";
    case UPDATE_STEP.ALARMS:
      return "location.update.step.alarms";
    default: {
      const unhandled: never = step;
      return unhandled;
    }
  }
};

/** What a step that threw leaves undone. */
const FAILED: Record<UpdateStep, ParseKeys> = {
  [UPDATE_STEP.LOCATION]: "location.update.failed.location",
  [UPDATE_STEP.PRAYER_TIMES]: "location.update.failed.prayerTimes",
  [UPDATE_STEP.NOTIFICATIONS]: "location.update.failed.notifications",
  [UPDATE_STEP.ALARMS]: "location.update.failed.alarms",
};

/** Notifications and alarms are both what the times set off, so one row. */
const ROW_OF: Record<UpdateStep, ProgressRow> = {
  [UPDATE_STEP.LOCATION]: PROGRESS_ROW.PLACE,
  [UPDATE_STEP.PRAYER_TIMES]: PROGRESS_ROW.TIMES,
  [UPDATE_STEP.NOTIFICATIONS]: PROGRESS_ROW.ALERTS,
  [UPDATE_STEP.ALARMS]: PROGRESS_ROW.ALERTS,
};

const ROWS = Object.values(PROGRESS_ROW);

const ROW_LABEL: Record<ProgressRow, ParseKeys> = {
  [PROGRESS_ROW.PLACE]: "location.update.steps.place",
  [PROGRESS_ROW.TIMES]: "location.update.steps.times",
  [PROGRESS_ROW.ALERTS]: "location.update.steps.alerts",
};

const ROW_STATE = { DONE: "done", NOW: "now", NEXT: "next" } as const;
type RowState = (typeof ROW_STATE)[keyof typeof ROW_STATE];

/** The state is said in words; the mark alone would be colour and shape. */
const SPOKEN: Record<RowState, ParseKeys> = {
  [ROW_STATE.DONE]: "a11y.location.update.stepDone",
  [ROW_STATE.NOW]: "a11y.location.update.stepNow",
  [ROW_STATE.NEXT]: "a11y.location.update.stepNext",
};

const stateOf = (row: ProgressRow, step: UpdateStep): RowState => {
  const at = ROWS.indexOf(ROW_OF[step]);
  const index = ROWS.indexOf(row);
  if (index < at) return ROW_STATE.DONE;
  return index === at ? ROW_STATE.NOW : ROW_STATE.NEXT;
};

/** Static marks: a wait never spins, so Reduce Motion has nothing to stop. */
const MarkGlyph = ({ state }: { state: RowState }) => {
  switch (state) {
    case ROW_STATE.DONE:
      return <Icon as={Check} size="xs" color="$accentText" />;
    case ROW_STATE.NOW:
      return <Box width="$2" height="$2" borderRadius="$pill" bg="$accentText" />;
    case ROW_STATE.NEXT:
      return <Icon as={Circle} size="xs" color="$muted" />;
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
};

/** Every mark in the xs icons' square, so the labels line up and stay put. */
const Mark = ({ state }: { state: RowState }) => (
  <Box
    testID={LOCATION_UPDATE_PART.MARK}
    width="$3.5"
    height="$3.5"
    alignItems="center"
    justifyContent="center">
    <MarkGlyph state={state} />
  </Box>
);

const StepRow = ({ row, state }: { row: ProgressRow; state: RowState }) => {
  const { t } = useTranslation();
  const label = t(ROW_LABEL[row]);
  return (
    <HStack
      alignItems="center"
      gap="$2"
      accessible
      accessibilityLabel={t(SPOKEN[state], { step: label })}>
      <Mark state={state} />
      <Text
        size="sm"
        flex={1}
        fontWeight={state === ROW_STATE.NOW ? "600" : undefined}
        color={state === ROW_STATE.NOW ? "$fg" : "$muted"}>
        {label}
      </Text>
    </HStack>
  );
};

/** The run's steps: what runs now, what is done and what is next. */
const RunningSteps = ({ run, inSheet }: { run: UpdateRun; inSheet: boolean }) => {
  const { t } = useTranslation();
  const { step } = run;
  const status = t(statusOf(run));
  useIosAnnouncement(status);
  return (
    <Card testID={LOCATION_UPDATE_PART.FRAME} variant={inSheet ? "panel" : "plain"} gap="$3">
      <HStack
        alignItems="center"
        gap="$2"
        accessible
        accessibilityLabel={status}
        accessibilityLiveRegion="polite">
        <Icon as={Hourglass} size="sm" color="$muted" />
        <Text size="md" fontWeight="600" color="$fg" flex={1}>
          {status}
        </Text>
      </HStack>
      {/* Set in under the status text: the icon's width and the gap. */}
      <VStack testID={LOCATION_UPDATE_PART.STEPS} gap="$2" paddingStart="$6">
        {ROWS.map((row) => (
          <StepRow key={row} row={row} state={stateOf(row, step)} />
        ))}
      </VStack>
      <HStack alignItems="flex-start" gap="$2">
        <Icon as={Info} size="sm" color="$muted" />
        <Text size="sm" color="$muted" flex={1}>
          {t("location.update.keepsTimes")}
        </Text>
      </HStack>
    </Card>
  );
};

type StoppedProps = { step: UpdateStep; onRetry: () => void };

/** What the step that threw left undone, said as the steps were. */
const StoppedStep = ({ step, onRetry }: StoppedProps) => {
  const { t } = useTranslation();
  const body = t(FAILED[step]);
  useIosAnnouncement(body);
  return <Callout body={body} action={{ label: t("common.retry"), onPress: onRetry }} />;
};

type Props = {
  /** The run to draw; null draws nothing. */
  run: UpdateRun | null;
  onRetry: () => void;
  /** Drawn inside a sheet: on its panel tone, not a lifted card. */
  inSheet?: boolean;
};

/** A location update's steps while it runs, or the step that stopped it. */
export const LocationUpdateProgress = ({ run, onRetry, inSheet = false }: Props) => {
  if (!run) return null;
  if (!run.failed) return <RunningSteps run={run} inSheet={inSheet} />;
  return <StoppedStep step={run.step} onRetry={onRetry} />;
};

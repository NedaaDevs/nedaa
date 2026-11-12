import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { Check, Circle, Hourglass, Info } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { ICON_SIZES, Icon, type IconSize } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  LOCATION_UPDATE_SURFACE,
  PROGRESS_ROW,
  UPDATE_STEP,
  type ProgressRow,
  type UpdateStep,
} from "@/constants/Location";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { FINDING_CITY, findingCity, type UpdateRun } from "@/stores/locationUpdate";

/** Test ids for the parts a test reaches. */
export const LOCATION_UPDATE_PART = {
  FRAME: "location-update-frame",
  STEPS: "location-update-steps",
  MARK: "location-update-mark",
  INSET: "location-update-inset",
} as const;

/** The status icon's step; the steps are set in by its width. */
const STATUS_ICON: IconSize = "md";
/** The status row's gap, repeated in the steps' inset. */
const STATUS_GAP = "$2";

/** The line naming what runs now, read aloud as it changes. */
const STATUS: Record<UpdateStep, ParseKeys> = {
  [UPDATE_STEP.LOCATION]: "location.update.step.findingPlace",
  [UPDATE_STEP.PRAYER_TIMES]: "location.update.step.prayerTimes",
  [UPDATE_STEP.NOTIFICATIONS]: "location.update.step.notifications",
  [UPDATE_STEP.ALARMS]: "location.update.step.alarms",
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
  [PROGRESS_ROW.PLACE]: "location.update.steps.placeRow",
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
        size="md"
        flex={1}
        fontWeight={state === ROW_STATE.NOW ? "600" : "500"}
        color={state === ROW_STATE.NOW ? "$fg" : "$muted"}>
        {label}
      </Text>
    </HStack>
  );
};

/** The run's steps: what runs now, what is done and what is next. */
const RunningSteps = ({ run, flat }: { run: UpdateRun; flat: boolean }) => {
  const { t } = useTranslation();
  const { step } = run;
  const status = t(findingCity(run) ? FINDING_CITY : STATUS[step]);
  useIosAnnouncement(status);
  // Flat inside a host card: no surface and no lift of its own.
  const Frame = flat ? VStack : Card;
  return (
    <Frame testID={LOCATION_UPDATE_PART.FRAME} gap="$3">
      <HStack
        alignItems="center"
        gap={STATUS_GAP}
        accessible
        accessibilityLabel={status}
        accessibilityLiveRegion="polite">
        <Icon as={Hourglass} size={STATUS_ICON} color="$muted" />
        <Text size="lg" fontWeight="600" color="$fg" flex={1}>
          {status}
        </Text>
      </HStack>
      {/* Set in under the status text: the icon's width and the row's gap. */}
      <HStack testID={LOCATION_UPDATE_PART.INSET} gap={STATUS_GAP}>
        <Box width={ICON_SIZES[STATUS_ICON]} />
        <VStack testID={LOCATION_UPDATE_PART.STEPS} flex={1} gap="$2">
          {ROWS.map((row) => (
            <StepRow key={row} row={row} state={stateOf(row, step)} />
          ))}
        </VStack>
      </HStack>
      <HStack alignItems="flex-start" gap="$2">
        <Icon as={Info} size="sm" color="$muted" />
        <Text size="sm" color="$muted" flex={1}>
          {t("location.update.keepsTimes")}
        </Text>
      </HStack>
    </Frame>
  );
};

type StoppedProps = { step: UpdateStep } & ({ flat: false; onRetry: () => void } | { flat: true });

/** What the step that threw left undone, said as the steps were. */
const StoppedStep = (props: StoppedProps) => {
  const { t } = useTranslation();
  const body = t(FAILED[props.step]);
  useIosAnnouncement(body);
  if (props.flat) {
    return (
      <Text
        size="sm"
        color="$fg"
        accessible
        accessibilityLabel={body}
        accessibilityLiveRegion="polite">
        {body}
      </Text>
    );
  }
  return <Callout body={body} action={{ label: t("common.retry"), onPress: props.onRetry }} />;
};

type Props = {
  /** The run to draw; null draws nothing. */
  run: UpdateRun | null;
} & (
  | {
      /** Its own lifted card, with Retry on a stopped step. */
      surface?: typeof LOCATION_UPDATE_SURFACE.CARD;
      onRetry: () => void;
    }
  | {
      /** Inside a host card, which draws Retry for a stopped step. */
      surface: typeof LOCATION_UPDATE_SURFACE.FLAT;
    }
);

/** A location update's steps while it runs, or the step that stopped it. */
export const LocationUpdateProgress = (props: Props) => {
  const { run } = props;
  if (!run) return null;
  const flat = props.surface === LOCATION_UPDATE_SURFACE.FLAT;
  if (!run.failed) return <RunningSteps run={run} flat={flat} />;
  return props.surface === LOCATION_UPDATE_SURFACE.FLAT ? (
    <StoppedStep step={run.step} flat />
  ) : (
    <StoppedStep step={run.step} flat={false} onRetry={props.onRetry} />
  );
};

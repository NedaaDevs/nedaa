import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useBusyRequest } from "@/components/onboarding/flow/useBusyRequest";
import { useViewFocus } from "@/components/onboarding/flow/useViewFocus";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  ALARM_PERMISSION_TITLE_KEY,
  ALARM_TYPE,
  isNeededPermission,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { DURATION_MS } from "@/constants/Motion";
import {
  ALARM_STEP_PHASE,
  NATIVE_READ_TIMEOUT_MS,
  ONBOARDING_PART,
  SETTINGS_OPEN_GRACE_MS,
  type AlarmStepPhase,
} from "@/constants/Onboarding";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType } from "@/types/alarm";
import {
  canRing,
  readAlarmPermissions,
  requestAlarmPermission,
  type AlarmPermission,
} from "@/utils/alarmPermissions";
import { nextForeground } from "@/utils/appForeground";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { withTimeout } from "@/utils/withTimeout";

const log = AppLogger.create("alarm");

const warn = (action: string, error: unknown) =>
  log.w("Onboarding", `${action} failed: ${errorText(error)}`);

const isGranted = (items: readonly AlarmPermission[], id: AlarmPermissionId) =>
  items.find((item) => item.id === id)?.granted ?? false;

/** The permissions now, or null when the read fails or stalls. */
const readNow = () =>
  withTimeout<AlarmPermission[] | null>(
    readAlarmPermissions().catch((error: unknown) => {
      warn("alarm permission read", error);
      return null;
    }),
    NATIVE_READ_TIMEOUT_MS,
    null,
    () => log.w("Onboarding", `alarm permission read gave no answer in ${NATIVE_READ_TIMEOUT_MS}ms`)
  );

/** True when another alarm type is already on. */
const anotherAlarmOn = (type: AlarmType) => {
  const settings = useAlarmSettingsStore.getState();
  return Object.values(ALARM_TYPE).some((other) => other !== type && settings[other].enabled);
};

/** What a granted item does; a missing one is needed or only recommended. */
const noteKey = (id: AlarmPermissionId, granted: boolean) => {
  if (granted) return `onboarding.alarm.note.${id}.done`;
  return isNeededPermission(id)
    ? `onboarding.alarm.note.${id}.needed`
    : `onboarding.alarm.note.${id}.recommended`;
};

/** How many of the device's items are granted, of how many. */
const grantedCount = (items: readonly AlarmPermission[]) => ({
  granted: items.filter((item) => item.granted).length,
  total: items.length,
});

type RowProps = { item: AlarmPermission; asking: boolean; failed: boolean };

/** One item: a tick that draws on a grant, its name, and its note. */
const PermissionRow = ({ item: { id, granted }, asking, failed }: RowProps) => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const tick = useSharedValue(granted ? 1 : 0);

  useEffect(() => {
    const target = granted ? 1 : 0;
    // A row that arrives granted is already ticked; only a change draws.
    if (tick.get() === target) return;
    tick.set(granted && !reduced ? withTiming(1, { duration: DURATION_MS.QUICK }) : target);
  }, [granted, reduced, tick]);

  const style = useAnimatedStyle(() => ({
    opacity: tick.get(),
    transform: [{ scale: tick.get() }],
  }));
  const name = t(ALARM_PERMISSION_TITLE_KEY[id]);
  const note = t(noteKey(id, granted));
  return (
    <HStack
      accessible
      accessibilityLabel={t("a11y.join", { first: name, second: note })}
      minHeight="$target"
      paddingVertical="$2"
      paddingHorizontal="$3"
      gap="$2.5"
      alignItems="center"
      borderRadius="$control"
      borderWidth={asking ? 2 : 1}
      borderColor={asking ? "$accent" : "$border"}
      backgroundColor="$surface2">
      <Box
        testID={`${ONBOARDING_PART.ALARM_TICK}-${id}`}
        width="$6"
        height="$6"
        alignItems="center"
        justifyContent="center"
        borderRadius="$pill"
        borderWidth={1.5}
        borderColor={granted ? "$accent" : failed ? "$danger" : "$border"}
        backgroundColor={granted ? "$accentSoft" : undefined}>
        <Animated.View style={style}>
          <Icon as={Check} size="xs" color="$accent" />
        </Animated.View>
      </Box>
      <VStack flex={1} gap="$0.5">
        <Text size="md" fontWeight={granted ? "600" : undefined} color="$fg">
          {name}
        </Text>
        <Text size="sm" color="$muted">
          {note}
        </Text>
      </VStack>
    </HStack>
  );
};

type ResultProps = {
  items: readonly AlarmPermission[];
  on: boolean;
  line: string;
  /** The whole result as one sentence; the step moves reader focus here. */
  label: string;
  cardRef: RefObject<View | null>;
};

/** How far it got: N of this device's M items, then what that means. */
const ResultCard = ({ items, on, line, label, cardRef }: ResultProps) => {
  const { t } = useTranslation();
  const count = grantedCount(items);

  return (
    <VStack
      ref={cardRef}
      testID={ONBOARDING_PART.ALARM_RESULT}
      accessible
      accessibilityLabel={label}
      alignItems="center"
      gap="$1.5"
      padding="$4"
      borderRadius="$card"
      borderWidth={1}
      borderColor={on ? "$accent" : "$border"}
      backgroundColor={on ? "$accentSoft" : undefined}>
      {items.length > 0 ? (
        <Text size="lg" bold color="$fg">
          {t("onboarding.alarm.count", count)}
        </Text>
      ) : null}
      <Text size="sm" typography="body" color="$mutedSky" textAlign="center">
        {line}
      </Text>
      {items.length > 0 ? (
        <HStack gap="$1.5" marginTop="$1" {...HIDDEN_FROM_READER}>
          {items.map((item) => (
            <Box
              key={item.id}
              testID={item.granted ? ONBOARDING_PART.ALARM_BAR_ON : ONBOARDING_PART.ALARM_BAR_OFF}
              width="$6"
              height="$1.5"
              borderRadius="$pill"
              backgroundColor={item.granted ? "$accent" : "$border"}
            />
          ))}
        </HStack>
      ) : null}
    </VStack>
  );
};

type Props = StepProps & { type: AlarmType };

/** One alarm, do or skip; it is switched on only when it can ring. */
export const AlarmStep = ({
  type,
  onSkip,
  setBusy,
  setPrimaryHidden,
  headingRef,
  progress,
}: Props) => {
  const { t } = useTranslation();
  const { becameActiveAt } = useAppVisibility();
  const haptic = useHaptic("light");
  // An alarm already on shows its result, read again, not the question.
  const [phase, setPhase] = useState<AlarmStepPhase>(() =>
    useAlarmSettingsStore.getState()[type].enabled ? ALARM_STEP_PHASE.CHECK : ALARM_STEP_PHASE.ASK
  );
  const [permissions, setPermissions] = useState<AlarmPermission[]>([]);
  const [asking, setAsking] = useState<AlarmPermissionId | null>(null);
  const { request, requesting } = useBusyRequest(setBusy);
  // Aborts when the step leaves: a run in flight stops acting, a wait ends.
  const leave = useRef<AbortController | null>(null);
  const resultRef = useRef<View>(null);

  const settle = (items: AlarmPermission[]) => {
    const ringable = canRing(items);
    // The stored switch matches the result shown, so a silent alarm stays off.
    useAlarmSettingsStore.getState().setEnabled(type, ringable);
    setPermissions(items);
    setPhase(ringable ? ALARM_STEP_PHASE.DONE : ALARM_STEP_PHASE.NOT_ON);
  };

  /** Runs `work` for this visit of the step, one run at a time. */
  const run = (work: (signal: AbortSignal) => Promise<void>) => {
    const signal = leave.current?.signal;
    if (signal) request(() => work(signal));
  };

  /** Asks each missing item in order; it acts only while the step is shown. */
  const runSequence = async (signal: AbortSignal) => {
    // A failed read counts nothing new as granted: it keeps what is known.
    let items = (await readNow()) ?? permissions;
    if (signal.aborted) return;
    // A device that can ring, with another alarm on, needs nothing asked again.
    if (canRing(items) && anotherAlarmOn(type)) {
      settle(items);
      return;
    }
    const missing = items.filter(({ granted }) => !granted).map(({ id }) => id);
    setPermissions(items);
    setPhase(ALARM_STEP_PHASE.SEQUENCE);
    for (const id of missing) {
      const item = items.find((permission) => permission.id === id);
      if (!item || item.granted) continue;
      setAsking(id);
      await requestAlarmPermission(item).catch((error: unknown) => warn(`${id} request`, error));
      // A system screen answers on the way back; an in-app prompt has answered.
      if (!item.canRequestInApp) await nextForeground(SETTINGS_OPEN_GRACE_MS, signal);
      if (signal.aborted) return;
      const before = items;
      items = (await readNow()) ?? items;
      if (signal.aborted) return;
      setPermissions(items);
      if (items.some((next) => next.granted && !isGranted(before, next.id))) void haptic();
      // Without a needed item the alarm cannot ring; asking on is pointless.
      if (isNeededPermission(id) && !isGranted(items, id)) break;
    }
    settle(items);
  };

  /** Reads the result again; a failed read writes no setting. */
  const recheck = async (signal: AbortSignal) => {
    const items = await readNow();
    if (signal.aborted) return;
    if (items) settle(items);
    // With no result on screen yet, the failure itself is the result.
    else if (phase === ALARM_STEP_PHASE.CHECK) setPhase(ALARM_STEP_PHASE.NOT_ON);
  };

  const turnOn = () => run(runSequence);

  const arrive = useEffectEvent(() => {
    if (phase === ALARM_STEP_PHASE.CHECK) run(recheck);
  });
  useEffect(() => {
    const controller = new AbortController();
    leave.current = controller;
    arrive();
    return () => controller.abort();
  }, []);

  const showsResult = phase === ALARM_STEP_PHASE.DONE || phase === ALARM_STEP_PHASE.NOT_ON;

  const onReturn = useEffectEvent(() => {
    if (showsResult) run(recheck);
  });
  useEffect(() => {
    if (becameActiveAt > 0) onReturn();
  }, [becameActiveAt]);

  // Before paint: the question draws its own answers; Continue never flashes.
  useLayoutEffect(() => {
    setPrimaryHidden(phase === ALARM_STEP_PHASE.ASK);
  });

  const missingNeeded = permissions.find(
    ({ id, granted }) => !granted && isNeededPermission(id)
  )?.id;
  const missingImproves = permissions.some(
    ({ id, granted }) => !granted && !isNeededPermission(id)
  );
  // An empty list names no item: the read failed, or the device has none.
  const notOn = missingNeeded
    ? t("onboarding.alarm.notOn", { item: t(ALARM_PERMISSION_TITLE_KEY[missingNeeded]) })
    : t("onboarding.alarm.failed");
  const line =
    phase === ALARM_STEP_PHASE.DONE
      ? t("onboarding.alarm.done")
      : phase === ALARM_STEP_PHASE.NOT_ON
        ? notOn
        : null;
  // An empty list has no count to read, only what it means.
  const result =
    line === null
      ? null
      : {
          line,
          label:
            permissions.length > 0
              ? t("a11y.join", {
                  first: t("onboarding.alarm.countA11y", grantedCount(permissions)),
                  second: line,
                })
              : line,
        };
  // A result is read from its card as it shows or changes; a view, its heading.
  // The check on arrival is part of it, so its first result moves nothing.
  useViewFocus(
    phase === ALARM_STEP_PHASE.CHECK ? null : (result?.label ?? phase),
    result ? resultRef : headingRef
  );

  const inSequence = phase === ALARM_STEP_PHASE.SEQUENCE;
  const title = inSequence ? t("onboarding.alarm.sequence") : t(`onboarding.alarm.${type}.title`);
  // Only an alarm on with an improvement missing has a rest to finish later.
  const body = inSequence
    ? t("onboarding.alarm.sequenceBody")
    : phase === ALARM_STEP_PHASE.ASK
      ? t(`onboarding.alarm.${type}.body`)
      : phase === ALARM_STEP_PHASE.DONE && missingImproves
        ? t("onboarding.alarm.resultBody")
        : undefined;

  return (
    <StepBody>
      <StepHeading headingRef={headingRef} progress={progress} title={title} body={body} />
      <SkyOccluder>
        {phase === ALARM_STEP_PHASE.ASK ? (
          <VStack gap="$2">
            <Text size="lg" fontWeight="700" typography="body" color="$fg">
              {t(`onboarding.alarm.${type}.question`)}
            </Text>
            <HStack gap="$2">
              <Button
                testID={ONBOARDING_PART.ALARM_TURN_ON}
                flex={1}
                action="primary"
                variant="solid"
                size="lg"
                disabled={requesting}
                onPress={turnOn}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.alarm.turnOn")}>
                <Button.Text>{t("onboarding.alarm.turnOn")}</Button.Text>
              </Button>
              <Button
                testID={ONBOARDING_PART.ALARM_LATER}
                flex={1}
                action="secondary"
                variant="outline"
                size="lg"
                disabled={requesting}
                onPress={onSkip}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.alarm.later")}>
                <Button.Text>{t("onboarding.alarm.later")}</Button.Text>
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack gap="$1.5">
            {permissions.map((item) => (
              <PermissionRow
                key={item.id}
                item={item}
                asking={inSequence && item.id === asking}
                failed={showsResult && !item.granted && isNeededPermission(item.id)}
              />
            ))}
            {result ? (
              <VStack paddingTop="$2">
                <ResultCard
                  items={permissions}
                  on={phase === ALARM_STEP_PHASE.DONE}
                  line={result.line}
                  label={result.label}
                  cardRef={resultRef}
                />
              </VStack>
            ) : null}
            {phase === ALARM_STEP_PHASE.NOT_ON ? (
              <Button
                testID={ONBOARDING_PART.ALARM_RETRY}
                action="secondary"
                variant="outline"
                size="lg"
                disabled={requesting}
                onPress={turnOn}
                accessibilityRole="button"
                accessibilityLabel={t("common.retry")}>
                <Button.Text>{t("common.retry")}</Button.Text>
              </Button>
            ) : null}
          </VStack>
        )}
      </SkyOccluder>
    </StepBody>
  );
};

export const FajrAlarmStep = (props: StepProps) => <AlarmStep {...props} type={ALARM_TYPE.FAJR} />;

export const FridayAlarmStep = (props: StepProps) => (
  <AlarmStep {...props} type={ALARM_TYPE.FRIDAY} />
);

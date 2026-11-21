import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, View, type ViewInstance } from "react-native";
import { useLocalSearchParams, Stack, Redirect } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Theme } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Background } from "@/components/ui/background";
import { COUNT_DIRECTION, Countdown } from "@/components/ui/countdown";

import { useAlarmScreen, type EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useAlarmPrayer } from "@/hooks/useAlarmPrayer";
import { useClockTime } from "@/hooks/useClockTime";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useQuietOffer } from "@/hooks/useQuietOffer";
import { TaskShell, TaskStart } from "@/components/alarm/challenges";
import EmergencyQuiet from "@/components/alarm/challenges/EmergencyQuiet";
import QuietBanner, { QuietStatus } from "@/components/alarm/challenges/QuietBanner";
import RingingHalo from "@/components/alarm/challenges/RingingHalo";
import SolvedPanel from "@/components/alarm/challenges/SolvedPanel";
import type { WakeTask } from "@/types/alarm";
import { PRESENTATION } from "@/constants/Navigation";
import { RINGING_MAX_WIDTH, RINGING_PART, RINGING_TYPE } from "@/constants/AlarmRinging";
import { COUNT_WIDEST } from "@/constants/Countdown";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { deviceTimeZone } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { focusOn } from "@/utils/accessibilityFocus";
import { isAlarmDue } from "@/utils/alarmDue";
import { isScheduledAlarmType } from "@/utils/alarmTypes";
import { formatTimeRemaining } from "@/utils/timeRemaining";
import { wayOutShown } from "@/utils/taskClock";
import { isNonEmpty, type TaskRunSnapshot } from "@/utils/taskRun";

const SECONDS_PER_MINUTE = 60;

const DUE_STATUS = { CHECKING: "checking", DUE: "due", NOT_DUE: "notDue" } as const;
type DueStatus = (typeof DUE_STATUS)[keyof typeof DUE_STATUS];

type TaskRun = Readonly<{
  /** When the task screen last opened, in epoch ms. */
  openedAt: number;
  snoozed: boolean;
  open: boolean;
  /** Where Back left the run, so reopening resumes it. */
  saved?: TaskRunSnapshot;
}>;

// Links reach this route before the alarm rings (the status bar's next-alarm
// entry, a stale Live Activity); only a ringing alarm may open the challenge.
export default function AlarmRoute() {
  const { alarmType, alarmId } = useLocalSearchParams<{
    alarmType: string;
    alarmId: string;
  }>();
  const [status, setStatus] = useState<DueStatus>(DUE_STATUS.CHECKING);

  useEffect(() => {
    let active = true;
    ExpoAlarm.getPendingChallenge()
      .catch(() => null)
      .then((pending) => {
        if (!active) return;
        // Read once: a snooze later replaces the record but not this decision.
        const record = useAlarmStore.getState().scheduledAlarms[alarmId];
        const due = isAlarmDue({
          alarmId,
          record,
          pendingAlarmId: pending?.alarmId ?? null,
          now: Date.now(),
        });
        setStatus(due ? DUE_STATUS.DUE : DUE_STATUS.NOT_DUE);
      });
    return () => {
      active = false;
    };
  }, [alarmId]);

  if (status === DUE_STATUS.CHECKING) return null;
  if (status === DUE_STATUS.NOT_DUE) return <Redirect href="/" />;
  // Keyed, so the next alarm starts with none of this one's state.
  return <AlarmTriggeredScreen key={alarmId} alarmId={alarmId} alarmType={alarmType} />;
}

function AlarmTriggeredScreen({ alarmId, alarmType }: { alarmId: string; alarmType: string }) {
  const {
    isSnoozed,
    isDismissed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    snoozeEnabled,
    snoozeMinutes,
    remainingSnoozes,
    tasks,
    handleChallengeComplete,
    handlePlainStop,
    handleClose,
    handleStop,
    handleSnooze,
    handleQuietStart,
    handleQuietEnd,
    emergency,
  } = useAlarmScreen(alarmId, alarmType);
  const insets = useSafeAreaInsets();

  // A link can carry a type no alarm has; it rings as a custom alarm.
  const type = isScheduledAlarmType(alarmType) ? alarmType : ScheduledAlarmType.CUSTOM;

  // The task run of this ring; Back keeps it, a snooze starting or ending
  // drops it.
  const [run, setRun] = useState<TaskRun | null>(null);
  if (run && run.snoozed !== isSnoozed) setRun(null);
  const openTask = () =>
    setRun({ openedAt: Date.now(), snoozed: isSnoozed, open: true, saved: run?.saved });
  const closeTask = (saved: TaskRunSnapshot) => {
    if (run) setRun({ ...run, open: false, saved });
  };

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerShown: false,
          presentation: PRESENTATION.FULL_SCREEN_MODAL,
        }}
      />
      <Theme name="dark">
        <StatusBar style="light" />
        <Background>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets>
            {run?.open && isNonEmpty(tasks) ? (
              <VStack
                flex={1}
                paddingTop={insets.top}
                paddingBottom={insets.bottom}
                paddingHorizontal="$screen">
                <VStack flex={1} paddingVertical="$section">
                  <TaskShell
                    tasks={tasks}
                    openedAt={run.openedAt}
                    resume={run.saved}
                    audible={!run.snoozed && emergency.quietUntil === null}
                    onComplete={handleChallengeComplete}
                    onStop={handleStop}
                    onBack={closeTask}
                    onQuietStart={handleQuietStart}
                    onQuietEnd={handleQuietEnd}
                    emergency={emergency}
                    solved={
                      <SolvedPanel alarmId={alarmId} alarmType={type} onClose={handleClose} />
                    }
                  />
                </VStack>
              </VStack>
            ) : isSnoozed && snoozeEndTime ? (
              <SnoozedView
                snoozeTimeRemaining={snoozeTimeRemaining}
                tasks={tasks}
                onStart={openTask}
                onStop={handlePlainStop}
              />
            ) : (
              <ActiveAlarmView
                alarmId={alarmId}
                alarmType={type}
                tasks={tasks}
                snooze={{
                  can: canSnooze,
                  enabled: snoozeEnabled,
                  minutes: snoozeMinutes,
                  left: remainingSnoozes,
                }}
                emergency={emergency}
                // A run Back left with the way out showing keeps the quiet hidden.
                wayOut={run?.saved ? wayOutShown(run.saved.clock) : false}
                onStart={openTask}
                onStop={handlePlainStop}
                onSnooze={handleSnooze}
              />
            )}
          </ScrollView>
          <QuietStatus
            quietUntil={emergency.quietUntil}
            used={emergency.used && !emergency.snoozed && !isDismissed}
          />
        </Background>
      </Theme>
    </>
  );
}

/** The ringing column: one width at most, inside the safe area. */
const RingingColumn = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets();
  return (
    <VStack
      flex={1}
      width="100%"
      maxWidth={RINGING_MAX_WIDTH}
      alignSelf="center"
      paddingHorizontal="$screen"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}>
      {children}
    </VStack>
  );
};

function SnoozedView({
  snoozeTimeRemaining,
  tasks,
  onStart,
  onStop,
}: {
  snoozeTimeRemaining: number;
  tasks: readonly WakeTask[];
  onStart: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const digits = (text: string) => localizeDigits(text, locale, western);
  // Said in whole minutes, so the label changes once a minute, not each second.
  const minutesLeft = Math.ceil(snoozeTimeRemaining / SECONDS_PER_MINUTE);

  return (
    <RingingColumn>
      <VStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$inline"
        paddingVertical="$section">
        <Text size="lg" fontWeight="500" color="$muted" accessibilityRole="header">
          {t("alarm.snoozed")}
        </Text>
        <View
          accessible
          accessibilityLabel={t("a11y.alarm.countdown", {
            time: t("common.minute", { count: minutesLeft }),
          })}>
          <Countdown
            value={digits(formatTimeRemaining(snoozeTimeRemaining))}
            reserve={digits(COUNT_WIDEST.minutes)}
            counting={COUNT_DIRECTION.DOWN}
            openKey={0}
            switchKey=""
            fontSize={RINGING_TYPE.COUNT.fontSize}
            lineHeight={RINGING_TYPE.COUNT.lineHeight}
            fontWeight="600"
            color="$fg"
          />
        </View>
        <Text size="lg" fontWeight="500" color="$muted" textAlign="center">
          {t("alarm.untilRingsAgain")}
        </Text>
      </VStack>
      <VStack paddingBottom="$section">
        <TaskStart tasks={tasks} onStart={onStart} onStop={onStop} />
      </VStack>
    </RingingColumn>
  );
}

type Snooze = Readonly<{
  /** A snooze is left and nothing holds it back. */
  can: boolean;
  enabled: boolean;
  minutes: number;
  left: number;
}>;

function ActiveAlarmView({
  alarmId,
  alarmType,
  tasks,
  snooze,
  emergency,
  wayOut,
  onStart,
  onStop,
  onSnooze,
}: {
  alarmId: string;
  alarmType: ScheduledAlarmType;
  tasks: readonly WakeTask[];
  snooze: Snooze;
  emergency: EmergencyQuietControl;
  wayOut: boolean;
  onStart: () => void;
  onStop: () => void;
  onSnooze: () => void;
}) {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const clockTime = useClockTime();
  const quietOffer = useQuietOffer(emergency, wayOut);
  const { alarm, prayer, moment } = useAlarmPrayer(alarmId, alarmType);
  const quiet = emergency.quietUntil !== null;

  // The prayer's time heads the screen; with none, the wall clock does.
  const time = moment ? clockTime(moment.time, moment.timezone) : clockTime(now, deviceTimeZone());
  const name = prayer ?? alarm;
  // A prayer alarm without its stored time shows the clock, said as the time now.
  const heading =
    prayer && !moment
      ? t("a11y.alarm.currentTime", { time: time.spoken })
      : t("a11y.alarm.ringingAt", { alarm, time: time.spoken });

  // Announced and focused once per screen; a re-render must not repeat it.
  const announced = useRef(false);
  const mainButton = useRef<ViewInstance>(null);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(
      prayer ? t("a11y.alarm.ringingAnnouncement", { prayer }) : t("a11y.alarm.ringingCustom")
    );
    focusOn(mainButton.current);
  }, [t, prayer]);

  return (
    <RingingColumn>
      <VStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$section">
        <RingingHalo breathing={!quiet} />
        <View accessible accessibilityRole="header" accessibilityLabel={heading}>
          <VStack alignItems="center" gap="$tight">
            {prayer ? (
              <Text size="lg" fontWeight="500" color="$muted" textAlign="center">
                {t("alarm.ringing.prayerAlarm")}
              </Text>
            ) : null}
            <Text
              fontSize={RINGING_TYPE.NAME.fontSize}
              lineHeight={RINGING_TYPE.NAME.lineHeight}
              bold
              color="$fg"
              textAlign="center">
              {name}
            </Text>
            <HStack alignItems="baseline" justifyContent="center" gap="$inline">
              <Text
                fontSize={RINGING_TYPE.TIME.fontSize}
                lineHeight={RINGING_TYPE.TIME.lineHeight}
                fontWeight="600"
                color="$fg"
                numeric
                numberOfLines={1}
                adjustsFontSizeToFit
                flexShrink={1}
                minWidth={0}>
                {time.figure}
              </Text>
              {time.period ? (
                <Text size="headline" fontWeight="600" color="$fg" flexShrink={0}>
                  {time.period}
                </Text>
              ) : null}
            </HStack>
          </VStack>
        </View>
      </VStack>

      <VStack gap="$stack" paddingBottom="$section">
        {emergency.quietUntil !== null && <QuietBanner until={emergency.quietUntil} />}
        <TaskStart ref={mainButton} tasks={tasks} onStart={onStart} onStop={onStop} />
        {/* The confirm stands in snooze's place; a running quiet holds none. */}
        {!quietOffer.confirmOpen && !quiet && <SnoozePlace snooze={snooze} onSnooze={onSnooze} />}
        <EmergencyQuiet control={emergency} offer={quietOffer} />
      </VStack>
    </RingingColumn>
  );
}

/** Snooze, or one line in its place, so the main button keeps its place. */
const SnoozePlace = ({ snooze, onSnooze }: { snooze: Snooze; onSnooze: () => void }) => {
  const { t } = useTranslation();

  if (!snooze.can) {
    return (
      <VStack testID={RINGING_PART.SNOOZE_OFF} minHeight="$16" justifyContent="center">
        <Text size="lg" fontWeight="500" color="$muted" textAlign="center">
          {t(snooze.enabled ? "alarm.ringing.snoozeUsedUp" : "alarm.ringing.snoozeOff")}
        </Text>
      </VStack>
    );
  }

  const title = t("alarm.ringing.snooze", { count: snooze.minutes });
  const left = t("alarm.ringing.snoozesLeft", { count: snooze.left });
  return (
    <Button
      size="xl"
      action="default"
      variant="outline"
      borderWidth={1.5}
      borderColor="$hairline"
      backgroundColor="$surface"
      borderRadius="$control"
      onPress={onSnooze}
      accessibilityLabel={t("a11y.join", { first: title, second: left })}>
      <VStack alignItems="center" gap="$0.5">
        <Button.Text size="xl" fontWeight="600" color="$fg">
          {title}
        </Button.Text>
        <Button.Text size="md" fontWeight="500" color="$muted">
          {left}
        </Button.Text>
      </VStack>
    </Button>
  );
};

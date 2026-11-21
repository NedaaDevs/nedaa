import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView } from "react-native";
import { useLocalSearchParams, Stack, Redirect } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Theme } from "tamagui";
import { parseISO } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Clock } from "lucide-react-native";

import { useAlarmScreen, type EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useClockTime } from "@/hooks/useClockTime";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useQuietOffer } from "@/hooks/useQuietOffer";
import { TaskShell, TaskStart } from "@/components/alarm/challenges";
import EmergencyQuiet from "@/components/alarm/challenges/EmergencyQuiet";
import QuietBanner, { QuietStatus } from "@/components/alarm/challenges/QuietBanner";
import type { WakeTask } from "@/types/alarm";
import { DayPrayerTimes, PrayerName } from "@/types/prayerTimes";
import { PRESENTATION } from "@/constants/Navigation";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { deviceTimeZone } from "@/utils/date";
import { isAlarmDue } from "@/utils/alarmDue";
import { isScheduledAlarmType } from "@/utils/alarmTypes";
import { PRAYER_ID } from "@/constants/Prayer";
import { formatTimeRemaining } from "@/utils/timeRemaining";
import { formatNumberToLocale } from "@/utils/number";
import { wayOutShown } from "@/utils/taskClock";
import { isNonEmpty, type TaskRunSnapshot } from "@/utils/taskRun";

// Prayer whose time heads the ringing screen, per alarm type. Jumu'ah is the
// Friday Dhuhr occurrence; custom alarms have no associated prayer.
const PRAYER_BY_ALARM: Record<
  ScheduledAlarmType.FAJR | ScheduledAlarmType.JUMMAH,
  { nameKey: string; timing: PrayerName }
> = {
  [ScheduledAlarmType.FAJR]: { nameKey: "prayerTimes.fajr", timing: PRAYER_ID.FAJR },
  [ScheduledAlarmType.JUMMAH]: { nameKey: "prayerTimes.jumuah", timing: PRAYER_ID.DHUHR },
};

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
  return <AlarmTriggeredScreen alarmId={alarmId} alarmType={alarmType} />;
}

function AlarmTriggeredScreen({ alarmId, alarmType }: { alarmId: string; alarmType: string }) {
  const {
    isSnoozed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    remainingSnoozes,
    tasks,
    handleChallengeComplete,
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
                  />
                </VStack>
              </VStack>
            ) : isSnoozed && snoozeEndTime ? (
              <SnoozedView
                snoozeTimeRemaining={snoozeTimeRemaining}
                tasks={tasks}
                onStart={openTask}
                onStop={handleChallengeComplete}
              />
            ) : (
              <ActiveAlarmView
                alarmId={alarmId}
                alarmType={type}
                tasks={tasks}
                canSnooze={canSnooze}
                remainingSnoozes={remainingSnoozes}
                emergency={emergency}
                // A run Back left with the way out showing keeps the quiet hidden.
                wayOut={run?.saved ? wayOutShown(run.saved.clock) : false}
                onStart={openTask}
                onStop={handleChallengeComplete}
                onSnooze={handleSnooze}
              />
            )}
          </ScrollView>
          <QuietStatus
            quietUntil={emergency.quietUntil}
            used={emergency.used && !emergency.snoozed}
          />
        </Background>
      </Theme>
    </>
  );
}

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
  const snoozeTime = formatNumberToLocale(formatTimeRemaining(snoozeTimeRemaining));
  return (
    <VStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$5">
      <Card padding="$8" width="100%" maxWidth={384} alignItems="center">
        <VStack gap="$4" alignItems="center" width="100%">
          <Icon as={Clock} size="xl" color="$info" />

          <Text size="2xl" bold color="$typography" accessibilityRole="header">
            {t("alarm.snoozed")}
          </Text>

          <Text
            size="4xl"
            bold
            color="$info"
            accessibilityLabel={t("a11y.alarm.countdown", {
              time: snoozeTime,
            })}
            accessibilityLiveRegion="polite">
            {snoozeTime}
          </Text>
          <Text size="sm" color="$typographySecondary">
            {t("alarm.untilRingsAgain")}
          </Text>

          <VStack marginTop="$6" width="100%" gap="$2">
            <TaskStart tasks={tasks} onStart={onStart} onStop={onStop} />
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

function ActiveAlarmView({
  alarmId,
  alarmType,
  tasks,
  canSnooze,
  remainingSnoozes,
  emergency,
  wayOut,
  onStart,
  onStop,
  onSnooze,
}: {
  alarmId: string;
  alarmType: ScheduledAlarmType;
  tasks: readonly WakeTask[];
  canSnooze: boolean;
  remainingSnoozes: number;
  emergency: EmergencyQuietControl;
  wayOut: boolean;
  onStart: () => void;
  onStop: () => void;
  onSnooze: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const now = useMinuteClock();
  const clockTime = useClockTime();
  const quietOffer = useQuietOffer(emergency, wayOut);

  const triggerTime = useAlarmStore((state) => state.getAlarm(alarmId)?.triggerTime);
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);

  const prayer = alarmType === ScheduledAlarmType.CUSTOM ? null : PRAYER_BY_ALARM[alarmType];
  const prayerName = prayer ? t(prayer.nameKey) : t("alarm.types.custom");

  // Prayer time nearest the alarm's trigger — picks the today/tomorrow
  // occurrence closest to when the alarm fired; null when data is unavailable
  // so a wrong time is never shown.
  const prayerTime = useMemo(() => {
    if (!prayer) return null;
    const candidates = [todayTimings, tomorrowTimings]
      .filter((day): day is DayPrayerTimes => !!day)
      .map((day) => ({ iso: day.timings[prayer.timing], tz: day.timezone }))
      .filter((entry) => !!entry.iso);
    if (candidates.length === 0) return null;

    const reference = triggerTime ?? now.getTime();
    const best = candidates.reduce((closest, entry) =>
      Math.abs(parseISO(entry.iso).getTime() - reference) <
      Math.abs(parseISO(closest.iso).getTime() - reference)
        ? entry
        : closest
    );
    return clockTime(parseISO(best.iso), best.tz);
  }, [prayer, todayTimings, tomorrowTimings, triggerTime, now, clockTime]);

  // The wall clock is drawn and spoken in the device's zone.
  const wallClock = clockTime(now, deviceTimeZone());

  // Announced once per screen; a later re-render must not repeat it.
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(
      t("a11y.alarm.ringingAnnouncement", { prayer: prayerName })
    );
  }, [t, prayerName]);

  return (
    <VStack
      flex={1}
      paddingHorizontal="$6"
      paddingTop={insets.top + 32}
      paddingBottom={insets.bottom + 24}>
      <VStack gap="$3" alignItems="center">
        <Text
          fontSize={64}
          bold
          color="$typography"
          accessibilityRole="header"
          accessibilityLabel={t("a11y.alarm.currentTime", { time: wallClock.spoken })}>
          {wallClock.shown}
        </Text>

        <Text
          size="xl"
          fontWeight="600"
          color="$typographySecondary"
          textAlign="center"
          accessibilityRole="header"
          accessibilityLabel={
            prayerTime
              ? t("a11y.alarm.prayerAt", { prayer: prayerName, time: prayerTime.spoken })
              : prayerName
          }>
          {prayerTime ? `${prayerName} · ${prayerTime.shown}` : prayerName}
        </Text>

        {alarmType === ScheduledAlarmType.FAJR && (
          <Text
            size="sm"
            color="$typographySecondary"
            textAlign="center"
            fontStyle="italic"
            opacity={0.8}>
            {t("alarm.prayerBetterThanSleep")}
          </Text>
        )}
      </VStack>

      <VStack flex={1} minHeight="$6" />

      <VStack gap="$3" width="100%" maxWidth={420} alignSelf="center">
        {emergency.quietUntil !== null && <QuietBanner until={emergency.quietUntil} />}
        <TaskStart tasks={tasks} onStart={onStart} onStop={onStop} />

        {/* The confirm stands in snooze's place. */}
        {canSnooze && !quietOffer.confirmOpen && (
          <Button
            size="sm"
            action="default"
            variant="outline"
            alignSelf="center"
            height={44}
            minHeight={44}
            paddingHorizontal="$5"
            borderColor="$typographySecondary"
            marginTop="$2"
            onPress={onSnooze}
            accessibilityLabel={t("a11y.alarm.snoozeButton", { count: remainingSnoozes })}>
            <HStack gap="$2" alignItems="center">
              <Icon as={Clock} size="sm" color="$typographySecondary" />
              <Button.Text color="$typographySecondary">
                {t("alarm.snoozeWithCount", { count: remainingSnoozes })}
              </Button.Text>
            </HStack>
          </Button>
        )}

        <EmergencyQuiet control={emergency} offer={quietOffer} />
      </VStack>
    </VStack>
  );
}

import { useEffect, useMemo } from "react";
import { AccessibilityInfo, ScrollView } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Theme } from "tamagui";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Clock } from "lucide-react-native";

import { ALARM_TYPE_META } from "@/constants/Alarm";
import { useAlarmScreen, formatTimeRemaining, useMinuteClock } from "@/hooks/useAlarmScreen";
import { ChallengeWrapper } from "@/components/alarm/challenges";
import { ChallengeConfig } from "@/types/alarm";
import { DayPrayerTimes, PrayerName } from "@/types/prayerTimes";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useAppStore } from "@/stores/app";
import { getDateLocale } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";

// Prayer whose time heads the ringing screen, per alarm type. Jumu'ah is the
// Friday Dhuhr occurrence; custom alarms have no associated prayer.
const PRAYER_BY_ALARM: Partial<Record<string, { nameKey: string; timing: PrayerName }>> = {
  [ScheduledAlarmType.FAJR]: { nameKey: "prayerTimes.fajr", timing: "fajr" },
  [ScheduledAlarmType.JUMMAH]: { nameKey: "prayerTimes.jumuah", timing: "dhuhr" },
};

const localeTime = (date: Date, locale: ReturnType<typeof useAppStore.getState>["locale"]) =>
  formatNumberToLocale(format(date, "h:mm a", { locale: getDateLocale(locale) }));

export default function AlarmTriggeredScreen() {
  const { alarmType, alarmId } = useLocalSearchParams<{
    alarmType: string;
    alarmId: string;
  }>();

  const {
    isSnoozed,
    snoozeEndTime,
    snoozeTimeRemaining,
    canSnooze,
    remainingSnoozes,
    challengeConfig,
    handleChallengeComplete,
    handleSnooze,
    handleGraceStart,
    handleGraceExpire,
  } = useAlarmScreen(alarmId, alarmType);

  const meta =
    ALARM_TYPE_META[(alarmType as keyof typeof ALARM_TYPE_META) ?? ScheduledAlarmType.CUSTOM] ??
    ALARM_TYPE_META[ScheduledAlarmType.CUSTOM];

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerShown: false,
          presentation: "fullScreenModal",
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
            {isSnoozed && snoozeEndTime ? (
              <SnoozedView
                snoozeTimeRemaining={snoozeTimeRemaining}
                challengeConfig={challengeConfig}
                onChallengeComplete={handleChallengeComplete}
                onGraceStart={handleGraceStart}
                onGraceExpire={handleGraceExpire}
              />
            ) : (
              <ActiveAlarmView
                alarmId={alarmId}
                alarmType={alarmType}
                metaTitle={meta.title}
                challengeConfig={challengeConfig}
                canSnooze={canSnooze}
                remainingSnoozes={remainingSnoozes}
                onChallengeComplete={handleChallengeComplete}
                onSnooze={handleSnooze}
                onGraceStart={handleGraceStart}
                onGraceExpire={handleGraceExpire}
              />
            )}
          </ScrollView>
        </Background>
      </Theme>
    </>
  );
}

function SnoozedView({
  snoozeTimeRemaining,
  challengeConfig,
  onChallengeComplete,
  onGraceStart,
  onGraceExpire,
}: {
  snoozeTimeRemaining: number;
  challengeConfig: ChallengeConfig;
  onChallengeComplete: () => void;
  onGraceStart: () => void;
  onGraceExpire: () => void;
}) {
  const { t } = useTranslation();
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
              time: formatTimeRemaining(snoozeTimeRemaining),
            })}
            accessibilityLiveRegion="polite">
            {formatTimeRemaining(snoozeTimeRemaining)}
          </Text>
          <Text size="sm" color="$typographySecondary">
            {t("alarm.untilRingsAgain")}
          </Text>

          <VStack marginTop="$6" width="100%" gap="$2">
            <ChallengeWrapper
              config={challengeConfig}
              onAllComplete={onChallengeComplete}
              onGraceStart={onGraceStart}
              onGraceExpire={onGraceExpire}
            />
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

function ActiveAlarmView({
  alarmId,
  alarmType,
  metaTitle,
  challengeConfig,
  canSnooze,
  remainingSnoozes,
  onChallengeComplete,
  onSnooze,
  onGraceStart,
  onGraceExpire,
}: {
  alarmId: string;
  alarmType: string;
  metaTitle: string;
  challengeConfig: ChallengeConfig;
  canSnooze: boolean;
  remainingSnoozes: number;
  onChallengeComplete: () => void;
  onSnooze: () => void;
  onGraceStart: () => void;
  onGraceExpire: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = useAppStore((state) => state.locale);
  const now = useMinuteClock();

  const triggerTime = useAlarmStore((state) => state.getAlarm(alarmId)?.triggerTime);
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);

  const prayer = PRAYER_BY_ALARM[alarmType];
  const prayerName = prayer
    ? t(prayer.nameKey)
    : t(`alarm.types.${alarmType}`, { defaultValue: metaTitle });

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

    const reference = triggerTime ?? Date.now();
    const best = candidates.reduce((closest, entry) =>
      Math.abs(parseISO(entry.iso).getTime() - reference) <
      Math.abs(parseISO(closest.iso).getTime() - reference)
        ? entry
        : closest
    );
    return formatNumberToLocale(
      formatInTimeZone(parseISO(best.iso), best.tz, "h:mm a", { locale: getDateLocale(locale) })
    );
  }, [prayer, todayTimings, tomorrowTimings, triggerTime, locale]);

  const clock = localeTime(now, locale);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      t("a11y.alarm.ringingAnnouncement", { prayer: prayerName })
    );
    // Announce once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          accessibilityLabel={t("a11y.alarm.currentTime", { time: clock })}>
          {clock}
        </Text>

        <Text
          size="xl"
          fontWeight="600"
          color="$typographySecondary"
          textAlign="center"
          accessibilityRole="header"
          accessibilityLabel={
            prayerTime
              ? t("a11y.alarm.prayerAt", { prayer: prayerName, time: prayerTime })
              : prayerName
          }>
          {prayerTime ? `${prayerName} · ${prayerTime}` : prayerName}
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
        <ChallengeWrapper
          config={challengeConfig}
          onAllComplete={onChallengeComplete}
          onGraceStart={onGraceStart}
          onGraceExpire={onGraceExpire}
        />

        {canSnooze && (
          <Button
            size="sm"
            variant="outline"
            action="default"
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
      </VStack>
    </VStack>
  );
}

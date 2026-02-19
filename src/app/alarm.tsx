import { useEffect, useRef } from "react";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Clock } from "lucide-react-native";

import { ALARM_TYPE_META } from "@/constants/Alarm";
import { useAlarmScreen, formatTimeRemaining } from "@/hooks/useAlarmScreen";
import { ChallengeWrapper } from "@/components/alarm/challenges";
import { ChallengeConfig } from "@/types/alarm";

const COLOR_MAP: Record<string, string> = {
  "text-warning": "$warning",
  "text-success": "$success",
  "text-info": "$info",
  "text-error": "$error",
  "text-purple-500": "$info",
};

export default function AlarmTriggeredScreen() {
  const { t } = useTranslation();
  const { alarmType, alarmId, action } = useLocalSearchParams<{
    alarmType: string;
    alarmId: string;
    action?: string;
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

  const hasRedirected = useRef(false);
  useEffect(() => {
    if (action === "complete" && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace({ pathname: "/alarm-complete", params: { alarmType } });
    }
  }, [action, alarmType]);

  if (action === "complete") {
    return null;
  }

  const meta =
    ALARM_TYPE_META[(alarmType as keyof typeof ALARM_TYPE_META) ?? "custom"] ??
    ALARM_TYPE_META.custom;

  const title = t(`alarm.types.${alarmType}`, { defaultValue: meta.title });

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Background>
        <VStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$5">
          <Card padding="$8" width="100%" maxWidth={384} alignItems="center">
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
                alarmType={alarmType}
                icon={meta.icon}
                title={title}
                colorClass={meta.colorClass}
                challengeConfig={challengeConfig}
                canSnooze={canSnooze}
                remainingSnoozes={remainingSnoozes}
                onChallengeComplete={handleChallengeComplete}
                onSnooze={handleSnooze}
                onGraceStart={handleGraceStart}
                onGraceExpire={handleGraceExpire}
              />
            )}
          </Card>
        </VStack>
      </Background>
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
    <VStack gap="$4" alignItems="center" width="100%">
      <Icon as={Clock} size="xl" color="$info" />

      <Text size="2xl" bold color="$typography">
        {t("alarm.snoozed")}
      </Text>

      <Text size="4xl" bold color="$info">
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
  );
}

function ActiveAlarmView({
  alarmType,
  icon,
  title,
  colorClass,
  challengeConfig,
  canSnooze,
  remainingSnoozes,
  onChallengeComplete,
  onSnooze,
  onGraceStart,
  onGraceExpire,
}: {
  alarmType: string;
  icon: React.ComponentType;
  title: string;
  colorClass: string;
  challengeConfig: ChallengeConfig;
  canSnooze: boolean;
  remainingSnoozes: number;
  onChallengeComplete: () => void;
  onSnooze: () => void;
  onGraceStart: () => void;
  onGraceExpire: () => void;
}) {
  const { t } = useTranslation();
  const resolvedColor = COLOR_MAP[colorClass] ?? "$typography";

  return (
    <VStack gap="$4" alignItems="center" width="100%">
      <Icon as={icon} size="xl" color={resolvedColor} />

      <Text size="2xl" bold color="$typography">
        {title}
      </Text>

      <Text textAlign="center" color="$typographySecondary">
        {t("alarm.wakeUpMessage")}
      </Text>

      {alarmType === "fajr" && (
        <Text textAlign="center" size="lg" fontWeight="500" color="$warning" fontStyle="italic">
          {t("alarm.prayerBetterThanSleep")}
        </Text>
      )}

      <ChallengeWrapper
        config={challengeConfig}
        onAllComplete={onChallengeComplete}
        onGraceStart={onGraceStart}
        onGraceExpire={onGraceExpire}
      />

      {canSnooze && (
        <Button
          size="lg"
          variant="outline"
          action="default"
          width="100%"
          marginTop="$2"
          onPress={onSnooze}>
          <HStack gap="$2" alignItems="center">
            <Icon as={Clock} size="sm" color="$typographySecondary" />
            <Button.Text color="$typographySecondary">
              {t("alarm.snoozeWithCount", { count: remainingSnoozes })}
            </Button.Text>
          </HStack>
        </Button>
      )}
    </VStack>
  );
}

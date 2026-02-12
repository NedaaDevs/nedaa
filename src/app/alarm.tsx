import { useEffect, useRef } from "react";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Clock } from "lucide-react-native";

import { ALARM_TYPE_META } from "@/constants/Alarm";
import { useAlarmScreen, formatTimeRemaining } from "@/hooks/useAlarmScreen";
import { ChallengeWrapper } from "@/components/alarm/challenges";
import { ChallengeConfig } from "@/types/alarm";

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
        <VStack className="flex-1 items-center justify-center p-6" space="xl">
          <Card className="p-8 w-full max-w-sm items-center">
            {isSnoozed && snoozeEndTime ? (
              <SnoozedView
                snoozeTimeRemaining={snoozeTimeRemaining}
                challengeConfig={challengeConfig}
                onChallengeComplete={handleChallengeComplete}
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
}: {
  snoozeTimeRemaining: number;
  challengeConfig: ChallengeConfig;
  onChallengeComplete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <VStack space="lg" className="items-center w-full">
      <Icon as={Clock} size="xl" className="text-purple-500" />

      <Text className="text-2xl font-bold text-typography">{t("alarm.snoozed")}</Text>

      <Text className="text-4xl font-bold text-purple-500">
        {formatTimeRemaining(snoozeTimeRemaining)}
      </Text>
      <Text className="text-sm text-typography-secondary">{t("alarm.untilRingsAgain")}</Text>

      <VStack className="mt-6 w-full" space="sm">
        <ChallengeWrapper config={challengeConfig} onAllComplete={onChallengeComplete} />
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
}) {
  const { t } = useTranslation();
  return (
    <VStack space="lg" className="items-center w-full">
      <Icon as={icon} size="xl" className={colorClass} />

      <Text className="text-2xl font-bold text-typography">{title}</Text>

      <Text className="text-center text-typography-secondary">{t("alarm.wakeUpMessage")}</Text>

      {alarmType === "fajr" && (
        <Text className="text-center text-lg font-medium text-warning italic">
          {t("alarm.prayerBetterThanSleep")}
        </Text>
      )}

      <ChallengeWrapper config={challengeConfig} onAllComplete={onChallengeComplete} />

      {canSnooze && (
        <Button size="lg" variant="outline" className="w-full mt-2" onPress={onSnooze}>
          <HStack space="sm" className="items-center">
            <Icon as={Clock} size="sm" className="text-typography-secondary" />
            <ButtonText className="text-typography-secondary">
              {t("alarm.snoozeWithCount", { count: remainingSnoozes })}
            </ButtonText>
          </HStack>
        </Button>
      )}
    </VStack>
  );
}

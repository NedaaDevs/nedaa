import { useLocalSearchParams, Stack } from "expo-router";

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
    remainingTaps,
    remainingSnoozes,
    handleTap,
    handleSnooze,
  } = useAlarmScreen(alarmId, alarmType);

  const meta =
    ALARM_TYPE_META[(alarmType as keyof typeof ALARM_TYPE_META) ?? "custom"] ??
    ALARM_TYPE_META.custom;

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
                remainingTaps={remainingTaps}
                onTap={handleTap}
              />
            ) : (
              <ActiveAlarmView
                icon={meta.icon}
                title={meta.title}
                colorClass={meta.colorClass}
                remainingTaps={remainingTaps}
                canSnooze={canSnooze}
                remainingSnoozes={remainingSnoozes}
                onTap={handleTap}
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
  remainingTaps,
  onTap,
}: {
  snoozeTimeRemaining: number;
  remainingTaps: number;
  onTap: () => void;
}) {
  return (
    <VStack space="lg" className="items-center">
      <Icon as={Clock} size="xl" className="text-purple-500" />

      <Text className="text-2xl font-bold text-typography">Snoozed</Text>

      <Text className="text-4xl font-bold text-purple-500">
        {formatTimeRemaining(snoozeTimeRemaining)}
      </Text>
      <Text className="text-sm text-typography-secondary">until alarm rings again</Text>

      <VStack className="mt-6 items-center" space="sm">
        <Text className="text-5xl font-bold text-typography">{remainingTaps}</Text>
        <Text className="text-sm text-typography-secondary">taps to dismiss forever</Text>
      </VStack>

      <Button size="xl" className="w-full mt-4" onPress={onTap}>
        <ButtonText className="text-lg">
          {remainingTaps > 0 ? "Tap to Dismiss" : "Done!"}
        </ButtonText>
      </Button>
    </VStack>
  );
}

function ActiveAlarmView({
  icon,
  title,
  colorClass,
  remainingTaps,
  canSnooze,
  remainingSnoozes,
  onTap,
  onSnooze,
}: {
  icon: React.ComponentType;
  title: string;
  colorClass: string;
  remainingTaps: number;
  canSnooze: boolean;
  remainingSnoozes: number;
  onTap: () => void;
  onSnooze: () => void;
}) {
  return (
    <VStack space="lg" className="items-center">
      <Icon as={icon} size="xl" className={colorClass} />

      <Text className="text-2xl font-bold text-typography">{title}</Text>

      <Text className="text-center text-typography-secondary">
        It&apos;s time to wake up for prayer!
      </Text>

      <Text className="text-5xl font-bold text-typography">{remainingTaps}</Text>
      <Text className="text-sm text-typography-secondary">taps remaining</Text>

      <Button size="xl" className="w-full mt-4" onPress={onTap}>
        <ButtonText className="text-lg">
          {remainingTaps > 0 ? "Tap to Dismiss" : "Done!"}
        </ButtonText>
      </Button>

      <Button
        size="lg"
        variant="outline"
        className="w-full mt-2"
        onPress={onSnooze}
        disabled={!canSnooze}>
        <HStack space="sm" className="items-center">
          <Icon
            as={Clock}
            size="sm"
            className={canSnooze ? "text-typography-secondary" : "text-typography-disabled"}
          />
          <ButtonText
            className={canSnooze ? "text-typography-secondary" : "text-typography-disabled"}>
            {canSnooze ? `Snooze (${remainingSnoozes} left)` : "No more snoozes"}
          </ButtonText>
        </HStack>
      </Button>
    </VStack>
  );
}

import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import { Vibration } from "react-native";
import * as ExpoAlarm from "expo-alarm";
import * as Crypto from "expo-crypto";

// Components
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";

// Icons
import { Bell, Sun, Building2 } from "lucide-react-native";

// Store
import { useAlarmStore } from "@/stores/alarm";
import { markAlarmHandled, isAlarmHandled } from "@/hooks/useAlarmDeepLink";

const TAPS_REQUIRED = 5;

export default function AlarmTriggeredScreen() {
  const { alarmType, alarmId } = useLocalSearchParams<{
    alarmType: string;
    alarmId: string;
  }>();

  const [tapCount, setTapCount] = useState(0);

  const { cancelAllAlarms, scheduleAlarm, getAlarm } = useAlarmStore();

  // Get alarm from store
  const alarm = useMemo(() => getAlarm(alarmId), [alarmId, getAlarm]);

  // If alarm is already handled, go back immediately
  useEffect(() => {
    if (isAlarmHandled(alarmId)) {
      console.log(`[Alarm] Already handled, redirecting home: ${alarmId}`);
      router.replace("/");
    }
  }, [alarmId]);

  // Update Live Activity to "firing" state when screen opens
  useEffect(() => {
    if (alarm?.liveActivityId && !isAlarmHandled(alarmId)) {
      ExpoAlarm.updateLiveActivity(alarm.liveActivityId, "firing");
    }
  }, [alarm?.liveActivityId, alarmId]);

  // Vibrate continuously
  useEffect(() => {
    Vibration.vibrate([0, 500, 200, 500], true);
    return () => Vibration.cancel();
  }, []);

  const handleTap = async () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= TAPS_REQUIRED) {
      Vibration.cancel();

      // Mark as handled so deep link won't re-trigger
      markAlarmHandled(alarmId);

      // Save alarm info before cancelling (for rescheduling)
      const alarmInfo = alarm
        ? { triggerTime: alarm.triggerTime, title: alarm.title, alarmType: alarm.alarmType }
        : null;

      // Cancel ALL alarms (native handles backup cleanup)
      console.log(`[Alarm] Challenge complete, cancelling all alarms`);
      await ExpoAlarm.cancelAllAlarms();
      await ExpoAlarm.endAllLiveActivities();

      // Schedule next day's alarm
      if (alarmInfo && (alarmType === "fajr" || alarmType === "jummah")) {
        const nextTrigger = new Date(alarmInfo.triggerTime + 24 * 60 * 60 * 1000);
        const nextId = Crypto.randomUUID();

        await scheduleAlarm({
          id: nextId,
          triggerDate: nextTrigger,
          title: alarmInfo.title,
          alarmType: alarmInfo.alarmType,
        });
        console.log(`[Alarm] Scheduled next: ${nextTrigger.toISOString()}`);
      }

      router.replace("/");
    }
  };

  const getAlarmIcon = () => {
    switch (alarmType) {
      case "fajr":
        return Sun;
      case "jummah":
        return Building2;
      default:
        return Bell;
    }
  };

  const getAlarmTitle = () => {
    switch (alarmType) {
      case "fajr":
        return "Fajr Alarm";
      case "jummah":
        return "Jummah Alarm";
      default:
        return "Alarm";
    }
  };

  const getAlarmColor = () => {
    switch (alarmType) {
      case "fajr":
        return "text-warning";
      case "jummah":
        return "text-success";
      default:
        return "text-info";
    }
  };

  const remainingTaps = TAPS_REQUIRED - tapCount;

  return (
    <Background>
      <VStack className="flex-1 items-center justify-center p-6" space="xl">
        <Card className="p-8 w-full max-w-sm items-center">
          <VStack space="lg" className="items-center">
            <Icon as={getAlarmIcon()} size="xl" className={getAlarmColor()} />

            <Text className="text-2xl font-bold text-typography">{getAlarmTitle()}</Text>

            <Text className="text-center text-typography-secondary">
              It&apos;s time to wake up for prayer!
            </Text>

            <Text className="text-5xl font-bold text-typography">{remainingTaps}</Text>
            <Text className="text-sm text-typography-secondary">taps remaining</Text>

            <Button size="xl" className="w-full mt-4" onPress={handleTap}>
              <ButtonText className="text-lg">
                {remainingTaps > 0 ? "Tap to Dismiss" : "Done!"}
              </ButtonText>
            </Button>
          </VStack>
        </Card>
      </VStack>
    </Background>
  );
}

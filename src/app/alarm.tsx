import { useLocalSearchParams, router } from "expo-router";
import { useEffect } from "react";
import { Vibration } from "react-native";

// Components
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";

// Icons
import { Bell, Sun, Building2 } from "lucide-react-native";

// Expo Alarm
import * as ExpoAlarm from "expo-alarm";

export default function AlarmTriggeredScreen() {
  const { alarmType, alarmId } = useLocalSearchParams<{
    alarmType: string;
    alarmId: string;
  }>();

  useEffect(() => {
    // Vibrate when screen opens
    Vibration.vibrate([0, 500, 200, 500], true);

    return () => {
      Vibration.cancel();
    };
  }, []);

  const handleDismiss = async () => {
    Vibration.cancel();

    // Cancel the alarm
    if (alarmId) {
      await ExpoAlarm.cancelAlarm(alarmId);
    }

    // Go back to home
    router.replace("/");
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

  return (
    <Background>
      <VStack className="flex-1 items-center justify-center p-6" space="xl">
        <Card className="p-8 w-full max-w-sm items-center">
          <VStack space="lg" className="items-center">
            {/* Icon */}
            <Icon as={getAlarmIcon()} size="xl" className={getAlarmColor()} />

            {/* Title */}
            <Text className="text-2xl font-bold text-typography">{getAlarmTitle()}</Text>

            {/* Message */}
            <Text className="text-center text-typography-secondary">
              It&apos;s time to wake up for prayer!
            </Text>

            {/* Alarm ID (debug) */}
            {__DEV__ && alarmId && (
              <Text className="text-xs text-typography-secondary font-mono">ID: {alarmId}</Text>
            )}

            {/* Dismiss Button */}
            <Button size="xl" className="w-full mt-4" onPress={handleDismiss}>
              <ButtonText className="text-lg">Dismiss</ButtonText>
            </Button>
          </VStack>
        </Card>
      </VStack>
    </Background>
  );
}

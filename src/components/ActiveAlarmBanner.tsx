import { useEffect, useState, useCallback } from "react";
import { AppState } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Bell, ChevronRight } from "lucide-react-native";

import { useAlarmStore } from "@/stores/alarm";
import { detectActiveAlarm, type ActiveAlarmInfo } from "@/utils/activeAlarmDetector";
import { navigateToAlarm } from "@/hooks/useAlarmDeepLink";

export default function ActiveAlarmBanner() {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmInfo | null>(null);
  const scheduledAlarms = useAlarmStore((s) => s.scheduledAlarms);

  const checkActiveAlarm = useCallback(async () => {
    const result = await detectActiveAlarm(scheduledAlarms);
    setActiveAlarm(result);
  }, [scheduledAlarms]);

  useEffect(() => {
    checkActiveAlarm();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkActiveAlarm();
      }
    });

    return () => sub.remove();
  }, [checkActiveAlarm]);

  if (!activeAlarm) return null;

  const handlePress = () => {
    navigateToAlarm(activeAlarm.alarmId, activeAlarm.alarmType, "banner-tap");
  };

  return (
    <Pressable onPress={handlePress} className="mx-4 mt-2 rounded-xl bg-error-600 p-4">
      <HStack className="items-center justify-between">
        <HStack space="md" className="items-center flex-1">
          <Icon as={Bell} size="md" className="text-white" />
          <VStack>
            <Text className="font-bold text-white">Active Alarm</Text>
            <Text className="text-sm text-white/80">{activeAlarm.title} — Tap to dismiss</Text>
          </VStack>
        </HStack>
        <Icon as={ChevronRight} size="md" className="text-white" />
      </HStack>
    </Pressable>
  );
}

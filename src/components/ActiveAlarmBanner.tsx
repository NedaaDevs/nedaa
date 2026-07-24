import { useEffect, useState, useCallback } from "react";
import { AppState, Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Bell, ChevronRight } from "lucide-react-native";

import { useAlarmStore } from "@/stores/alarm";
import { detectActiveAlarm, type ActiveAlarmInfo } from "@/utils/activeAlarmDetector";
import { completeAndRescheduleAlarm } from "@/utils/alarmScheduler";
import { navigateToAlarm, markAlarmHandled } from "@/hooks/useAlarmDeepLink";

export default function ActiveAlarmBanner() {
  const { t } = useTranslation();
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

  const handlePress = async () => {
    // iOS: the /alarm screen is the challenge UI, so navigate there.
    if (Platform.OS !== "android") {
      navigateToAlarm(activeAlarm.alarmId, activeAlarm.alarmType, "banner-tap");
      return;
    }
    // Android dismissal is the native overlay, not a JS screen. The banner is a
    // recovery affordance for a challenge left pending (overlay permission missing,
    // or dismissed from the notification): the alarm already rang, so a tap clears
    // it (matching the "tap to dismiss" label) and reschedules a recurring alarm.
    markAlarmHandled(activeAlarm.alarmId);
    setActiveAlarm(null);
    await completeAndRescheduleAlarm(activeAlarm.alarmId);
  };

  return (
    <Pressable
      onPress={handlePress}
      marginHorizontal="$4"
      marginTop="$2"
      borderRadius="$6"
      backgroundColor="$error"
      padding="$4"
      accessibilityRole="button"
      accessibilityLabel={t("alarm.banner.activeAlarm")}>
      <HStack alignItems="center" justifyContent="space-between">
        <HStack gap="$3" alignItems="center" flex={1}>
          <Icon as={Bell} size="md" color="$typographyContrast" />
          <VStack>
            <Text bold color="$typographyContrast">
              {t("alarm.banner.activeAlarm")}
            </Text>
            <Text size="sm" color="$typographyContrast" opacity={0.8}>
              {t("alarm.banner.tapToDismiss", { title: activeAlarm.title })}
            </Text>
          </VStack>
        </HStack>
        <Icon as={ChevronRight} size="md" color="$typographyContrast" />
      </HStack>
    </Pressable>
  );
}

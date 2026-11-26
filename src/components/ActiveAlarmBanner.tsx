import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Bell, ChevronRight } from "lucide-react-native";

import { useAlarmStore } from "@/stores/alarm";
import { detectActiveAlarm, type ActiveAlarmInfo } from "@/utils/activeAlarmDetector";
import { openAlarmOnRequest } from "@/hooks/useAlarmDeepLink";

export default function ActiveAlarmBanner() {
  const { t } = useTranslation();
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmInfo | null>(null);
  const scheduledAlarms = useAlarmStore((s) => s.scheduledAlarms);

  useEffect(() => {
    const checkActiveAlarm = async () => {
      const result = await detectActiveAlarm(scheduledAlarms);
      setActiveAlarm(result);
    };

    void checkActiveAlarm();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkActiveAlarm();
      }
    });

    return () => sub.remove();
  }, [scheduledAlarms]);

  if (!activeAlarm) return null;

  // The alarm screen holds the task; a running overlay keeps it instead.
  const handlePress = () => {
    openAlarmOnRequest(activeAlarm.alarmId, activeAlarm.alarmType);
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
      accessibilityLabel={t("a11y.alarm.banner.label", { title: activeAlarm.title })}
      accessibilityHint={t("a11y.alarm.banner.hint")}>
      <HStack alignItems="center" justifyContent="space-between">
        <HStack gap="$3" alignItems="center" flex={1}>
          <Icon as={Bell} size="md" color="$typographyContrast" />
          <VStack>
            <Text bold color="$typographyContrast">
              {t("alarm.banner.activeAlarm")}
            </Text>
            <Text size="sm" color="$typographyContrast" opacity={0.8}>
              {t("alarm.banner.tapToOpen", { title: activeAlarm.title })}
            </Text>
          </VStack>
        </HStack>
        <Icon as={ChevronRight} size="md" color="$typographyContrast" />
      </HStack>
    </Pressable>
  );
}

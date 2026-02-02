import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { router } from "expo-router";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";
import TopBar from "@/components/TopBar";

import { ChevronRight, Sun, Calendar } from "lucide-react-native";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useRTL } from "@/contexts/RTLContext";

const AlarmSettings = () => {
  const { t } = useTranslation();
  const { fajr, friday } = useAlarmSettingsStore();
  const { isRTL } = useRTL();

  const alarmTypes = [
    {
      type: "fajr",
      title: t("alarm.settings.fajrAlarm"),
      description: t("alarm.settings.fajrDescription"),
      icon: Sun,
      enabled: fajr.enabled,
    },
    {
      type: "friday",
      title: t("alarm.settings.fridayAlarm"),
      description: t("alarm.settings.fridayDescription"),
      icon: Calendar,
      enabled: friday.enabled,
    },
  ];

  return (
    <Background>
      <TopBar title="alarm.settings.title" href="/settings" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack className="flex-1">
          <Box className="mx-4 mt-4 mb-2">
            <Text className="text-sm text-typography-secondary">
              {t("alarm.settings.description")}
            </Text>
          </Box>

          <VStack className="mx-2">
            {alarmTypes.map((alarm, index) => (
              <Box key={alarm.type}>
                <Pressable
                  className="p-4 rounded-xl bg-background-secondary m-2"
                  onPress={() => router.push(`/settings/alarm/${alarm.type}` as any)}>
                  <HStack className="justify-between items-center">
                    <HStack className="items-center flex-1" space="md">
                      <Box className="w-12 h-12 rounded-full bg-surface-active items-center justify-center">
                        <Icon as={alarm.icon} size="xl" className="text-typography" />
                      </Box>

                      <VStack className="flex-1">
                        <HStack className="items-center" space="sm">
                          <Text className="text-lg font-semibold text-typography">
                            {alarm.title}
                          </Text>
                          <Badge
                            action={alarm.enabled ? "success" : "muted"}
                            size="sm"
                            className="rounded-full">
                            <BadgeText>
                              {alarm.enabled ? t("common.on") : t("common.off")}
                            </BadgeText>
                          </Badge>
                        </HStack>
                        <Text className="text-sm text-typography-secondary" numberOfLines={2}>
                          {alarm.description}
                        </Text>
                      </VStack>
                    </HStack>

                    <Icon
                      as={ChevronRight}
                      size="lg"
                      className={`text-typography-secondary ${isRTL ? "rotate-180" : ""}`}
                    />
                  </HStack>
                </Pressable>

                {index < alarmTypes.length - 1 && (
                  <Divider className="bg-outline mx-6 w-[calc(100%-48px)]" />
                )}
              </Box>
            ))}
          </VStack>

          <Box className="mx-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push("/settings/alarm-debug")}>
              <ButtonText>Debug Panel</ButtonText>
            </Button>
          </Box>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmSettings;

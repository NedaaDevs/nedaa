import { useLocalSearchParams, Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Sun, Building2, CheckCircle } from "lucide-react-native";

type AlarmType = "fajr" | "jummah" | "custom";

const SUCCESS_CONTENT: Record<
  AlarmType,
  {
    icon: React.ComponentType;
    titleKey: string;
    subtitleKey: string;
    colorClass: string;
  }
> = {
  fajr: {
    icon: Sun,
    titleKey: "alarm.complete.fajr.title",
    subtitleKey: "alarm.complete.fajr.subtitle",
    colorClass: "text-warning",
  },
  jummah: {
    icon: Building2,
    titleKey: "alarm.complete.friday.title",
    subtitleKey: "alarm.complete.friday.subtitle",
    colorClass: "text-success",
  },
  custom: {
    icon: CheckCircle,
    titleKey: "alarm.complete.custom.title",
    subtitleKey: "alarm.complete.custom.subtitle",
    colorClass: "text-info",
  },
};

export default function AlarmCompleteScreen() {
  const { t } = useTranslation();
  const { alarmType } = useLocalSearchParams<{ alarmType: string }>();

  const type: AlarmType = (alarmType as AlarmType) ?? "custom";
  const content = SUCCESS_CONTENT[type] ?? SUCCESS_CONTENT.custom;

  const handleGoHome = () => {
    router.replace("/");
  };

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Background>
        <VStack className="flex-1 items-center justify-center p-6" space="xl">
          <Card className="p-8 w-full max-w-sm items-center">
            <VStack space="lg" className="items-center w-full">
              <Icon as={content.icon} size="xl" className={content.colorClass} />

              <Text className="text-2xl font-bold text-typography text-center">
                {t(content.titleKey)}
              </Text>

              <Text className="text-center text-typography-secondary">
                {t(content.subtitleKey)}
              </Text>

              <Text className="text-center text-lg font-medium text-success italic mt-2">
                {t("alarm.complete.encouragement")}
              </Text>

              <Button size="lg" className="w-full mt-4 bg-primary" onPress={handleGoHome}>
                <ButtonText className="text-typography-contrast">
                  {t("alarm.complete.goHome")}
                </ButtonText>
              </Button>
            </VStack>
          </Card>
        </VStack>
      </Background>
    </>
  );
}

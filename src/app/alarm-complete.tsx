import { useLocalSearchParams, Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Background } from "@/components/ui/background";
import { Icon } from "@/components/ui/icon";
import { Sun, Building2, CheckCircle } from "lucide-react-native";

type AlarmType = "fajr" | "jummah" | "custom";

const COLOR_MAP: Record<string, string> = {
  "text-warning": "$warning",
  "text-success": "$success",
  "text-info": "$info",
};

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
  const resolvedColor = COLOR_MAP[content.colorClass] ?? "$typography";

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
        <VStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$5">
          <Card padding="$8" width="100%" maxWidth={384} alignItems="center">
            <VStack gap="$4" alignItems="center" width="100%">
              <Icon as={content.icon} size="xl" color={resolvedColor} />

              <Text size="2xl" bold color="$typography" textAlign="center">
                {t(content.titleKey)}
              </Text>

              <Text textAlign="center" color="$typographySecondary">
                {t(content.subtitleKey)}
              </Text>

              <Text
                textAlign="center"
                size="lg"
                fontWeight="500"
                color="$success"
                fontStyle="italic"
                marginTop="$2">
                {t("alarm.complete.encouragement")}
              </Text>

              <Button size="lg" width="100%" marginTop="$4" onPress={handleGoHome}>
                <Button.Text>{t("alarm.complete.goHome")}</Button.Text>
              </Button>
            </VStack>
          </Card>
        </VStack>
      </Background>
    </>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonText } from "@/components/ui/button";

import { requestNotificationPermission } from "@/utils/notifications";

type NotificationsStepProps = {
  onNext: () => void;
};

const NotificationsStep = ({ onNext }: NotificationsStepProps) => {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);

  const handleAllow = async () => {
    const { status } = await requestNotificationPermission();

    if (status !== "granted") {
      setDenied(true);
      setTimeout(onNext, 1500);
      return;
    }

    onNext();
  };

  return (
    <VStack className="flex-1 items-center justify-center px-8" space="xl">
      <Box className="w-20 h-20 rounded-full bg-background-info items-center justify-center">
        <Icon as={Bell} size="xl" className="text-info" />
      </Box>

      <VStack space="sm" className="items-center">
        <Text className="text-2xl font-bold text-typography text-center">
          {t("onboarding.notifications.title")}
        </Text>
        <Text className="text-base text-typography-secondary text-center" style={{ maxWidth: 280 }}>
          {t("onboarding.notifications.description")}
        </Text>
      </VStack>

      {denied ? (
        <Text className="text-sm text-typography-secondary text-center" style={{ maxWidth: 280 }}>
          {t("onboarding.notifications.denied")}
        </Text>
      ) : (
        <Button onPress={handleAllow} className="min-h-[44px] px-12 bg-primary" size="lg">
          <ButtonText className="font-medium text-typography-contrast">
            {t("onboarding.notifications.allow")}
          </ButtonText>
        </Button>
      )}
    </VStack>
  );
};

export default NotificationsStep;

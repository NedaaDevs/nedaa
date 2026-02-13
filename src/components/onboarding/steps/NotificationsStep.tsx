import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

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
    <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8" gap="$5">
      {denied ? (
        <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
          {t("onboarding.notifications.denied")}
        </Text>
      ) : (
        <>
          <Box
            width={80}
            height={80}
            borderRadius={999}
            backgroundColor="$backgroundInfo"
            alignItems="center"
            justifyContent="center">
            <Icon as={Bell} size="xl" color="$info" />
          </Box>

          <VStack gap="$2" alignItems="center">
            <Text size="3xl" bold textAlign="center">
              {t("onboarding.notifications.title")}
            </Text>
            <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
              {t("onboarding.notifications.description")}
            </Text>
          </VStack>

          <Button
            onPress={handleAllow}
            size="lg"
            paddingHorizontal="$12"
            accessibilityLabel={t("onboarding.notifications.allow")}>
            <Button.Text fontWeight="500">{t("onboarding.notifications.allow")}</Button.Text>
          </Button>
        </>
      )}
    </VStack>
  );
};

export default NotificationsStep;

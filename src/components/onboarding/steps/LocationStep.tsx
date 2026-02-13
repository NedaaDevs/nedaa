import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

import { requestLocationPermission } from "@/utils/location";

type LocationStepProps = {
  onNext: () => void;
};

const LocationStep = ({ onNext }: LocationStepProps) => {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);

  const handleAllow = async () => {
    const { granted } = await requestLocationPermission();

    if (!granted) {
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
          {t("onboarding.location.denied")}
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
            <Icon as={MapPin} size="xl" color="$info" />
          </Box>

          <VStack gap="$2" alignItems="center">
            <Text size="3xl" bold textAlign="center">
              {t("onboarding.location.title")}
            </Text>
            <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
              {t("onboarding.location.description")}
            </Text>
          </VStack>

          <Button
            onPress={handleAllow}
            size="lg"
            paddingHorizontal="$12"
            accessibilityLabel={t("onboarding.location.allow")}>
            <Button.Text fontWeight="500">{t("onboarding.location.allow")}</Button.Text>
          </Button>
        </>
      )}
    </VStack>
  );
};

export default LocationStep;

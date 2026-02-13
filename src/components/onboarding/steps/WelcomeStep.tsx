import { Image } from "react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

type WelcomeStepProps = {
  onNext: () => void;
};

const WelcomeStep = ({ onNext }: WelcomeStepProps) => {
  const { t } = useTranslation();

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8" gap="$5">
      <Box width={96} height={96} borderRadius="$9" overflow="hidden">
        <Image
          source={require("../../../../assets/images/icon.png")}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </Box>

      <VStack gap="$2" alignItems="center">
        <Text size="3xl" bold textAlign="center">
          {t("onboarding.welcome.title")}
        </Text>
        <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
          {t("onboarding.welcome.tagline")}
        </Text>
      </VStack>

      <Button onPress={onNext} size="lg" paddingHorizontal="$12">
        <Button.Text fontWeight="500">{t("onboarding.welcome.getStarted")}</Button.Text>
      </Button>
    </VStack>
  );
};

export default WelcomeStep;

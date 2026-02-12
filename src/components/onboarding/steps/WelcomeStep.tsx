import { Image } from "react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";

type WelcomeStepProps = {
  onNext: () => void;
};

const WelcomeStep = ({ onNext }: WelcomeStepProps) => {
  const { t } = useTranslation();

  return (
    <VStack className="flex-1 items-center justify-center px-8" space="xl">
      <Box className="w-24 h-24 rounded-3xl overflow-hidden">
        <Image
          source={require("../../../../assets/images/icon.png")}
          className="w-full h-full"
          resizeMode="contain"
        />
      </Box>

      <VStack space="sm" className="items-center">
        <Text className="text-2xl font-bold text-typography text-center">
          {t("onboarding.welcome.title")}
        </Text>
        <Text className="text-base text-typography-secondary text-center" style={{ maxWidth: 280 }}>
          {t("onboarding.welcome.tagline")}
        </Text>
      </VStack>

      <Button onPress={onNext} className="min-h-[44px] px-12 bg-primary" size="lg">
        <ButtonText className="font-medium text-typography-contrast">
          {t("onboarding.welcome.getStarted")}
        </ButtonText>
      </Button>
    </VStack>
  );
};

export default WelcomeStep;

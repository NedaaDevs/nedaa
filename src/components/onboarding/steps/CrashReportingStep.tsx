import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonText } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { useAppStore } from "@/stores/app";

type CrashReportingStepProps = {
  onNext: () => void;
};

const CrashReportingStep = ({ onNext }: CrashReportingStepProps) => {
  const { t } = useTranslation();
  const { sendCrashLogs, setSendCrashLogs } = useAppStore();

  return (
    <VStack className="flex-1 items-center justify-center px-8" space="xl">
      <Box className="w-20 h-20 rounded-full bg-background-info items-center justify-center">
        <Icon as={Shield} size="xl" className="text-info" />
      </Box>

      <VStack space="sm" className="items-center">
        <Text className="text-2xl font-bold text-typography text-center">
          {t("onboarding.crashReporting.title")}
        </Text>
        <Text className="text-base text-typography-secondary text-center" style={{ maxWidth: 280 }}>
          {t("onboarding.crashReporting.description")}
        </Text>
      </VStack>

      <HStack className="items-center justify-between w-full px-4" style={{ maxWidth: 320 }}>
        <Text className="text-base text-typography">{t("onboarding.crashReporting.enable")}</Text>
        <Switch value={sendCrashLogs} onValueChange={setSendCrashLogs} />
      </HStack>

      <Button onPress={onNext} className="min-h-[44px] px-12 bg-primary" size="lg">
        <ButtonText className="font-medium text-typography-contrast">
          {t("onboarding.crashReporting.finish")}
        </ButtonText>
      </Button>
    </VStack>
  );
};

export default CrashReportingStep;

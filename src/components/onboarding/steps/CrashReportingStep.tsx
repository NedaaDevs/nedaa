import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { useAppStore } from "@/stores/app";

type CrashReportingStepProps = {
  onNext: () => void;
};

const CrashReportingStep = ({ onNext }: CrashReportingStepProps) => {
  const { t } = useTranslation();
  const { sendCrashLogs, setSendCrashLogs } = useAppStore();

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8" gap="$5">
      <Box
        width={80}
        height={80}
        borderRadius={999}
        backgroundColor="$backgroundInfo"
        alignItems="center"
        justifyContent="center">
        <Icon as={Shield} size="xl" color="$info" />
      </Box>

      <VStack gap="$2" alignItems="center">
        <Text size="3xl" bold textAlign="center">
          {t("onboarding.crashReporting.title")}
        </Text>
        <Text size="lg" color="$typographySecondary" textAlign="center" maxWidth={280}>
          {t("onboarding.crashReporting.description")}
        </Text>
      </VStack>

      <HStack
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        paddingHorizontal="$4"
        maxWidth={320}>
        <Text size="lg">{t("onboarding.crashReporting.enable")}</Text>
        <Switch
          value={sendCrashLogs}
          onValueChange={setSendCrashLogs}
          accessibilityLabel={t("onboarding.crashReporting.enable")}
        />
      </HStack>

      <Button onPress={onNext} size="lg" paddingHorizontal="$12">
        <Button.Text fontWeight="500">{t("onboarding.crashReporting.finish")}</Button.Text>
      </Button>
    </VStack>
  );
};

export default CrashReportingStep;

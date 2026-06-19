// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

// Icons
import { Bug } from "lucide-react-native";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { AppLogger } from "@/utils/appLogger";

// Shares the on-device diagnostic logs (all domains) via the OS share sheet — which
// attaches the .log file and lists the user's apps (email, WhatsApp, Files, …). Logs
// are local; sharing here is the user's explicit consent.
const CrashLogButton = () => {
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");

  return (
    <Pressable
      minHeight={44}
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      onPress={() => {
        hapticMedium();
        AppLogger.shareAllLogs();
      }}
      accessibilityRole="button"
      accessibilityLabel={t("settings.shareLogs.label")}
      accessibilityHint={t("settings.shareLogs.hint")}>
      <HStack alignItems="center" gap="$2">
        <Icon as={Bug} color="$typographySecondary" size="sm" />
        <Text size="sm" color="$typographySecondary">
          {t("settings.shareLogs.label")}
        </Text>
      </HStack>
    </Pressable>
  );
};

export default CrashLogButton;

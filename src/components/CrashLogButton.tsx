// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

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
      alignItems="center"
      justifyContent="center"
      padding="$2"
      borderRadius="$2"
      minHeight={44}
      minWidth={44}
      onPress={() => {
        hapticMedium();
        AppLogger.shareAllLogs();
      }}
      accessibilityRole="button"
      accessibilityLabel={t("settings.shareLogs.label")}
      accessibilityHint={t("settings.shareLogs.hint")}>
      <Icon as={Bug} color="$typographySecondary" />
    </Pressable>
  );
};

export default CrashLogButton;

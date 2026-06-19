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

// Shares the diagnostic logs (all domains) via the OS share sheet. Logs are local —
// sharing here is the user's explicit consent. (Plan 4 replaces this with the unified
// "Report a problem" screen.)
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
      accessibilityLabel={t("settings.crashReporting.accessibilityLabel")}
      accessibilityHint={t("settings.crashReporting.accessibilityHint")}>
      <Icon color="$typography" as={Bug} />
    </Pressable>
  );
};

export default CrashLogButton;

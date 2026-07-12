import { router } from "expo-router";

// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Icons
import { Bug } from "lucide-react-native";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Opens the in-app feedback form, preset to a bug report (diagnostics auto-attached).
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
        router.push("/settings/feedback?type=bug" as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={t("feedback.title")}
      accessibilityHint={t("feedback.a11y.openHint")}>
      <Icon as={Bug} color="$typographySecondary" />
    </Pressable>
  );
};

export default CrashLogButton;

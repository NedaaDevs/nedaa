import { useTranslation } from "react-i18next";

import { Pressable } from "@/components/ui/pressable";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Bug } from "lucide-react-native";
import { useHaptic } from "@/hooks/useHaptic";
import { AppLogger } from "@/utils/appLogger";

interface ReportThisButtonProps {
  // Logger domains relevant to the failing feature (rolled into the shared bundle).
  domains: string[];
  // Short label that becomes the bundle's category.
  category: string;
}

// Contextual "Report this" affordance shown where a critical operation fails. Builds a
// scoped diagnostic bundle and opens the OS share sheet (with the .log file attached).
const ReportThisButton = ({ domains, category }: ReportThisButtonProps) => {
  const { t } = useTranslation();
  const haptic = useHaptic("medium");

  return (
    <Pressable
      onPress={() => {
        haptic();
        void AppLogger.shareReport({ domains, category });
      }}
      minHeight={44}
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      accessibilityRole="button"
      accessibilityLabel={t("reportThis.label")}>
      <HStack alignItems="center" gap="$2" justifyContent="center">
        <Icon as={Bug} color="$typographySecondary" size="sm" />
        <Text size="sm" color="$typographySecondary">
          {t("reportThis.label")}
        </Text>
      </HStack>
    </Pressable>
  );
};

export default ReportThisButton;

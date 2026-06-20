import { useState } from "react";

// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import ReportProblemModal from "@/components/ReportProblemModal";

// Icons
import { Bug } from "lucide-react-native";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { AppLogger } from "@/utils/appLogger";

// Opens the shared "Report a problem" sheet, fed by the on-device logs (all domains).
const CrashLogButton = () => {
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Pressable
        alignItems="center"
        justifyContent="center"
        padding="$2"
        borderRadius="$2"
        minHeight={44}
        minWidth={44}
        onPress={() => {
          hapticMedium();
          setSheetOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("settings.shareLogs.label")}
        accessibilityHint={t("settings.shareLogs.hint")}>
        <Icon as={Bug} color="$typographySecondary" />
      </Pressable>

      <ReportProblemModal
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        emailSubject={t("settings.shareLogs.emailSubject")}
        getReportText={() => AppLogger.buildReport({ category: "App" })}
        getSummaryText={() => AppLogger.buildSummary({})}
        baseName="report"
      />
    </>
  );
};

export default CrashLogButton;

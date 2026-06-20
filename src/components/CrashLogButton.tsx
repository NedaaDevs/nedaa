import { useState } from "react";

// Components
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import ShareLogsSheet from "@/components/ShareLogsSheet";

// Icons
import { Bug } from "lucide-react-native";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Opens the share-logs bottom sheet (Share file via OS sheet, or Copy). Logs are
// local; sharing is the user's explicit action.
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

      <ShareLogsSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};

export default CrashLogButton;

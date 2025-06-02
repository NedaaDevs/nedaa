import React from "react";
import { useTranslation } from "react-i18next";

// Hooks
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Components
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import MethodSettings from "@/components/AladhanSettings/MethodSettings";

const AladhanSettings: React.FC = () => {
  const { t } = useTranslation();
  const { isModified, saveSettings } = useProviderSettingsStore();

  return (
    <Box className="relative">
      {isModified && (
        <Box className="sticky top-0 z-30  backdrop-blur-sm border-b border-gray-100 shadow-sm py-2 px-4">
          <Button onPress={saveSettings} className="w-full">
            {t("common.save")}
          </Button>
        </Box>
      )}

      <MethodSettings />
      {/* Temporarily comment out other settings until we implement them
      <SchoolSettings />
      <MidnightModeSettings />
      <LatitudeAdjustmentSettings /> */}
    </Box>
  );
};

export default AladhanSettings;

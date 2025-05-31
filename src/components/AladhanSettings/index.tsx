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
  const { isDirty, saveSettings } = useProviderSettingsStore();

  return (
    <Box className="relative">
      {isDirty && (
        <Box className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm py-2 px-4">
          <Button
            onPress={saveSettings}
            className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700">
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

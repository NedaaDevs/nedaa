import { FC } from "react";

// Hooks
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";

import MethodSettings from "@/components/AladhanSettings/MethodSettings";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const AladhanSettings: FC = () => {
  const { t } = useTranslation();
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { isLoading, isModified, saveSettings } = useProviderSettingsStore();

  const handleSaveSetting = async () => {
    try {
      await saveSettings();
      // Refetch prayer times with new settings
      await loadPrayerTimes(true);
    } catch (error) {
      console.error("Failed saving settings: ", error);
    }
  };

  return (
    <Box className="relative mx-4 mt-2">
      {(isModified || isLoading || isFetchingPrayers) && (
        <Box className="sticky top-0 z-30 bg-primary dark:bg-primary backdrop-blur-sm border-b border-gray-100 py-2 mb-2 rounded-lg">
          <Button
            onPress={handleSaveSetting}
            className="w-full"
            isDisabled={isLoading || isFetchingPrayers}>
            {!(isLoading || isFetchingPrayers) && (
              <ButtonText className="text-secondary">{t("common.save")}</ButtonText>
            )}
            {(isLoading || isFetchingPrayers) && <ButtonSpinner />}
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

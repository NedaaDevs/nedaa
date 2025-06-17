import { FC } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";

import MethodSettings from "@/components/AladhanSettings/MethodSettings";
import SchoolSettings from "@/components/AladhanSettings/SchoolSettings";
import MidnightModeSettings from "@/components/AladhanSettings/MidnightModeSettings";
import TuningSettings from "@/components/AladhanSettings/TuningSettings";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";

const AladhanSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { isLoading, isModified, saveSettings } = useProviderSettingsStore();

  const handleSaveSetting = async () => {
    try {
      await saveSettings();
      await loadPrayerTimes(true);
      hapticSuccess();
    } catch (error) {
      console.error("Failed saving settings: ", error);
    }
  };

  return (
    <Box className="relative mx-4 mt-2">
      {(isModified || isLoading || isFetchingPrayers) && (
        <Box className="w-full bg-accent-primary rounded-lg">
          <Button
            onPress={handleSaveSetting}
            className="w-full bg-accent-primary"
            isDisabled={isLoading || isFetchingPrayers}>
            {!(isLoading || isFetchingPrayers) && (
              <ButtonText className="text-background">{t("common.save")}</ButtonText>
            )}
            {(isLoading || isFetchingPrayers) && <ButtonSpinner />}
          </Button>
        </Box>
      )}

      <MethodSettings />
      <SchoolSettings />
      <MidnightModeSettings />
      <TuningSettings />
    </Box>
  );
};

export default AladhanSettings;

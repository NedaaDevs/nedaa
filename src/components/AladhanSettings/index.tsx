import { FC, useState } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { MessageToast } from "@/components/feedback";

import { MethodSettings } from "@/components/AladhanSettings/MethodSettings";
import { SchoolSettings } from "@/components/AladhanSettings/SchoolSettings";
import { MidnightModeSettings } from "@/components/AladhanSettings/MidnightModeSettings";
import { TuningSettings } from "@/components/AladhanSettings/TuningSettings";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useNotificationStore } from "@/stores/notification";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { reloadPrayerWidgets } from "../../../modules/expo-widget/src";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("prayertimes");

const AladhanSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { isLoading, isModified, saveSettings } = useProviderSettingsStore();
  const { scheduleAllNotifications } = useNotificationStore();

  // Keeps the save affordance on screen after a failed refetch so the change can be retried.
  const [saveFailed, setSaveFailed] = useState(false);

  const handleSaveSetting = async () => {
    try {
      await saveSettings();

      // The settings only reach the user once the times are refetched with them, so this
      // runs on every save — an unapplied change looks identical to a broken setting.
      await loadPrayerTimes(true);

      await scheduleAllNotifications();
      await rescheduleAllAlarms();

      reloadPrayerWidgets();

      setSaveFailed(false);
      hapticSuccess();
    } catch (error) {
      setSaveFailed(true);
      MessageToast.showError(t("providers.saveFailed"));
      log.e(
        "Settings",
        "applying provider settings failed",
        error instanceof Error ? error : undefined
      );
    }
  };

  return (
    <Box position="relative" marginHorizontal="$4" marginTop="$2">
      {(isModified || isLoading || isFetchingPrayers || saveFailed) && (
        <Box width="100%" backgroundColor="$accentPrimary" borderRadius="$4">
          <Button
            onPress={handleSaveSetting}
            backgroundColor="$accentPrimary"
            width="100%"
            disabled={isLoading || isFetchingPrayers}>
            {!(isLoading || isFetchingPrayers) && (
              <Button.Text color="$typographyContrast">{t("common.save")}</Button.Text>
            )}
            {(isLoading || isFetchingPrayers) && <Button.Spinner />}
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

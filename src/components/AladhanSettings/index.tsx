import { FC, useRef } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";

import { MethodSettings } from "@/components/AladhanSettings/MethodSettings";
import { SchoolSettings } from "@/components/AladhanSettings/SchoolSettings";
import { MidnightModeSettings } from "@/components/AladhanSettings/MidnightModeSettings";
import { TuningSettings } from "@/components/AladhanSettings/TuningSettings";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useNotificationStore } from "@/stores/notification";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";

const AladhanSettings: FC = () => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { isLoading, isModified, saveSettings } = useProviderSettingsStore();
  const { scheduleAllNotifications } = useNotificationStore();

  // Throttling refs to prevent excessive API calls
  const lastPrayerTimesUpdateRef = useRef<number>(0);

  // Throttle periods in milliseconds
  const PRAYER_TIMES_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

  const handleSaveSetting = async () => {
    try {
      await saveSettings();

      const now = Date.now();

      // Throttle prayer times updates
      const shouldUpdatePrayerTimes =
        now - lastPrayerTimesUpdateRef.current > PRAYER_TIMES_THROTTLE_MS;
      if (shouldUpdatePrayerTimes) {
        lastPrayerTimesUpdateRef.current = now;
        await loadPrayerTimes(true);
      } else {
        const remainingTime = Math.ceil(
          (PRAYER_TIMES_THROTTLE_MS - (now - lastPrayerTimesUpdateRef.current)) / 1000
        );
        console.log(
          `[AladhanSettings] Prayer times update throttled. Next update in ${remainingTime}s`
        );
      }

      await scheduleAllNotifications();
      await rescheduleAllAlarms();

      hapticSuccess();
    } catch (error) {
      console.error("Failed saving settings: ", error);
    }
  };

  return (
    <Box position="relative" marginHorizontal="$4" marginTop="$2">
      {(isModified || isLoading || isFetchingPrayers) && (
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

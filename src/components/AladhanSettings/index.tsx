import { FC, useRef } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";

import { MethodSettings } from "@/components/AladhanSettings/MethodSettings";
import { SchoolSettings } from "@/components/AladhanSettings/SchoolSettings";
import { MidnightModeSettings } from "@/components/AladhanSettings/MidnightModeSettings";
import { TuningSettings } from "@/components/AladhanSettings/TuningSettings";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useNotificationStore } from "@/stores/notification";

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
            isDisabled={isLoading || isFetchingPrayers}
            accessibilityLabel={t("accessibility.saveProviderSettings")}
            accessibilityHint={t("accessibility.saveAndUpdatePrayerTimes")}
            accessibilityState={{
              disabled: isLoading || isFetchingPrayers,
              busy: isLoading || isFetchingPrayers,
            }}>
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

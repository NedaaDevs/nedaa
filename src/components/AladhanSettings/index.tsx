import { FC, useMemo, useState } from "react";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";
import { useAladhanSettings } from "@/hooks/useProviderSettings";

// Components
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { MessageToast } from "@/components/feedback";

import { SettingSection } from "@/components/AladhanSettings/SettingSection";
import { TuningSettings } from "@/components/AladhanSettings/TuningSettings";

// Config
import { buildAladhanSections } from "@/components/AladhanSettings/sections";

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
  const hapticSelection = useHaptic("selection");
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { isLoading, isModified, saveSettings, markSettingsApplied } = useProviderSettingsStore();
  const { scheduleAllNotifications } = useNotificationStore();
  const { settings, updateSettings } = useAladhanSettings();

  // Keeps the save affordance on screen after a failed refetch so the change can be retried.
  const [saveFailed, setSaveFailed] = useState(false);

  const sections = useMemo(
    () => (settings ? buildAladhanSections(settings, t) : []),
    [settings, t]
  );

  const handleSaveSetting = async () => {
    try {
      await saveSettings();

      // The settings only reach the user once the times are refetched with them, so this
      // runs on every save — an unapplied change looks identical to a broken setting.
      await loadPrayerTimes(true);

      await scheduleAllNotifications();
      await rescheduleAllAlarms();

      reloadPrayerWidgets();

      // Last: until this runs the edit is pending, and the store keeps the save
      // affordance on screen even if the user navigates away and back.
      markSettingsApplied();

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

      {/* One skeleton for the whole form; the sections load together. */}
      {isLoading ? (
        <Box marginTop="$6" testID="settings-form-skeleton">
          <Card padding="$6" alignItems="center">
            <Spinner size="small" />
            <Text fontSize="$2" color="$typographySecondary" marginTop="$3">
              {t("common.loading")}
            </Text>
          </Card>
        </Box>
      ) : (
        sections.map((section) => (
          <SettingSection
            key={section.key}
            section={section}
            onChange={(value) => {
              hapticSelection();
              const patch = section.apply(value);
              if (patch) updateSettings(patch);
            }}
          />
        ))
      )}

      <TuningSettings />
    </Box>
  );
};

export default AladhanSettings;

import { FC, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Hooks
import { useTranslation } from "react-i18next";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { MessageToast } from "@/components/feedback";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { useNotificationStore } from "@/stores/notification";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";

// Services
import { applyProviderSettings, type ApplyStep } from "@/services/applyProviderSettings";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("prayertimes");

// The apply runs the same work as the location update, so it reuses that copy.
const STEP_KEYS: Record<ApplyStep, string> = {
  prayerTimes: "location.update.step.prayerTimes",
  notifications: "location.update.step.notifications",
  alarms: "location.update.step.alarms",
};

/** Pinned below the form so it stays reachable wherever the user is editing. */
export const ProviderSaveBar: FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hapticSuccess = useHaptic("success");

  const { isLoading, isModified, saveSettings, markSettingsApplied } = useProviderSettingsStore();
  const { isLoading: isFetchingPrayers, loadPrayerTimes } = usePrayerTimesStore();
  const { scheduleAllNotifications } = useNotificationStore();

  const [step, setStep] = useState<ApplyStep | null>(null);
  // Keeps the bar on screen after a failure so the change can be retried.
  const [saveFailed, setSaveFailed] = useState(false);

  const isApplying = isLoading || isFetchingPrayers || step !== null;

  const handleSave = async () => {
    try {
      await applyProviderSettings(
        {
          saveSettings,
          loadPrayerTimes,
          scheduleAllNotifications,
          rescheduleAllAlarms,
          reloadPrayerWidgets,
          markSettingsApplied,
        },
        setStep
      );

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
    } finally {
      setStep(null);
    }
  };

  if (!isModified && !isApplying && !saveFailed) return null;

  return (
    <Box
      testID="provider-save-bar"
      paddingHorizontal="$4"
      paddingTop="$3"
      paddingBottom={insets.bottom + 12}
      backgroundColor="$backgroundSecondary"
      borderTopWidth={1}
      borderTopColor="$outline">
      {step && (
        <HStack
          alignItems="center"
          gap="$2"
          marginBottom="$3"
          accessibilityLiveRegion="polite"
          accessibilityLabel={t(STEP_KEYS[step])}>
          <ActivityIndicator size="small" />
          <Text size="sm" color="$typographySecondary">
            {t(STEP_KEYS[step])}
          </Text>
        </HStack>
      )}

      <Button
        onPress={handleSave}
        backgroundColor="$accentPrimary"
        width="100%"
        disabled={isApplying}
        accessibilityRole="button"
        accessibilityLabel={t("common.save")}
        accessibilityState={{ disabled: isApplying }}>
        {isApplying ? (
          <Button.Spinner />
        ) : (
          <Button.Text color="$typographyContrast">{t("common.save")}</Button.Text>
        )}
      </Button>
    </Box>
  );
};

export default ProviderSaveBar;

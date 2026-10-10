import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MessageToast } from "@/components/feedback";
import { STICKY_ACTION_STATE, type StickyActionState } from "@/constants/StickyActionBar";
import { useHaptic } from "@/hooks/useHaptic";
import { applyProviderSettings, type ApplyStep } from "@/services/applyProviderSettings";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { rescheduleAllAlarms } from "@/utils/alarmScheduler";
import { AppLogger } from "@/utils/appLogger";
import { reloadPrayerWidgets } from "../../modules/expo-widget/src";

const log = AppLogger.create("prayertimes");

// The apply runs the same work as the location update, so it reuses that copy.
const STEP_KEYS: Record<ApplyStep, string> = {
  prayerTimes: "location.update.step.prayerTimes",
  notifications: "location.update.step.notifications",
  alarms: "location.update.step.alarms",
};

/**
 * Applies the drafted calculation settings: save, refetch, reschedule. A failed run
 * keeps the draft, so the action stays offered for a retry.
 */
export const useApplyCalculation = () => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");
  const isModified = useProviderSettingsStore((state) => state.isModified);
  const saveSettings = useProviderSettingsStore((state) => state.saveSettings);
  const markSettingsApplied = useProviderSettingsStore((state) => state.markSettingsApplied);
  const { loadPrayerTimes } = usePrayerTimesStore();
  const { scheduleAllNotifications } = useNotificationStore();
  const [step, setStep] = useState<ApplyStep | null>(null);
  // Held in the operation, not the button: the error toast's retry calls it too.
  const running = useRef(false);

  const apply = async () => {
    if (running.current) return;
    running.current = true;
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
      hapticSuccess();
    } catch (error) {
      MessageToast.showError(t("providers.saveFailed"), {
        action: { label: t("common.retry"), onPress: apply },
      });
      log.e(
        "Settings",
        "applying provider settings failed",
        error instanceof Error ? error : undefined
      );
    } finally {
      running.current = false;
      setStep(null);
    }
  };

  const busy = step !== null;
  const state: StickyActionState = busy
    ? STICKY_ACTION_STATE.BUSY
    : isModified
      ? STICKY_ACTION_STATE.READY
      : STICKY_ACTION_STATE.HIDDEN;

  return { state, busy, status: step ? t(STEP_KEYS[step]) : "", apply };
};

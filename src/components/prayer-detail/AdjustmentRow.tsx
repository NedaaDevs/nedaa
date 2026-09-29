import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SlidersHorizontal } from "lucide-react-native";

import { summarisePrayerTuning } from "@/components/AladhanSettings/tuning";
import { ListRow } from "@/components/ui/list-row";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import type { PrayerId } from "@/constants/Prayer";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { useProviderSettingsStore } from "@/stores/providerSettings";

/** This prayer's offset from its calculated time; opens provider settings. */
export const AdjustmentRow = ({ prayerId }: { prayerId: PrayerId }) => {
  const { t } = useTranslation();
  const providerId = useProviderSettingsStore((state) => state.currentProviderId);
  const tuning = useProviderSettingsStore(
    (state) => state.allSettings[state.currentProviderId]?.tune
  );

  // Only Aladhan takes a per-prayer offset; another provider's time is its own.
  const status =
    providerId === PRAYER_TIME_PROVIDERS.ALADHAN.id
      ? summarisePrayerTuning(tuning, prayerId, t)
      : t("prayerDetail.adjustment.byProvider");

  return (
    <ListRow
      icon={SlidersHorizontal}
      title={t("prayerDetail.adjustment.title")}
      status={status}
      hint={t("a11y.prayerDetail.adjustment.hint")}
      onPress={() => router.push(BACK_DESTINATION.SETTINGS_PROVIDER.href)}
    />
  );
};

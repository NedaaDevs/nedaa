import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { Callout } from "@/components/ui/callout";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** While no location is known, the times are Makkah's; this says so. */
export const LocationNotice = () => {
  const { t } = useTranslation();
  const usingDefault = usePrayerTimesStore((state) => state.usingDefaultLocation);
  if (!usingDefault) return null;

  return (
    <Callout
      body={t("today.defaultLocation.body")}
      action={{
        label: t("today.defaultLocation.action"),
        hint: t("a11y.today.locationHint"),
        onPress: () => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href),
      }}
    />
  );
};

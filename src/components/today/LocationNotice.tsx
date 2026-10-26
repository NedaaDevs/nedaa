import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { StandInNotice } from "@/components/location/StandInNotice";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

/** Today's stand-in notice, with the way to the Location settings. */
export const LocationNotice = () => {
  const { t } = useTranslation();
  return (
    <StandInNotice
      action={{
        label: t("today.defaultLocation.action"),
        hint: t("a11y.today.locationHint"),
        onPress: () => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href),
      }}
    />
  );
};

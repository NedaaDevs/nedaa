import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { router, useFocusEffect } from "expo-router";

import { CityChangeOffer } from "@/components/location/CityChangeOffer";
import { StandInNotice, useStandInNotice } from "@/components/location/StandInNotice";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { CITY_OFFER_STAGE } from "@/constants/CityOffer";
import { useLocationStore } from "@/stores/location";

/** Today's one note: the stand-in times notice, else the city offer. */
export const LocationNotice = () => {
  const { t } = useTranslation();
  const standIn = useStandInNotice();

  // A settled note stays until Today shows again; an unanswered offer stays.
  useFocusEffect(
    useCallback(() => {
      const { cityOffer, dismissCityOffer } = useLocationStore.getState();
      if (cityOffer && cityOffer.stage.kind !== CITY_OFFER_STAGE.OFFER) dismissCityOffer();
    }, [])
  );

  if (!standIn) return <CityChangeOffer />;
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

import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { CITY_PICKER_VIEW, LOCATION_PICKER, type CityPickerView } from "@/constants/Location";
import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";

const TITLES: Record<CityPickerView, ParseKeys> = {
  [CITY_PICKER_VIEW.LIST]: "location.picker.title",
  [CITY_PICKER_VIEW.COORDINATES]: "location.coordinates.title",
};

const LocationPickerScreen = () => {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Partial<Record<typeof LOCATION_PICKER.viewParam, string>>>();
  // Anything but coordinates opens the list.
  const [view, setView] = useState<CityPickerView>(() =>
    params[LOCATION_PICKER.viewParam] === CITY_PICKER_VIEW.COORDINATES
      ? CITY_PICKER_VIEW.COORDINATES
      : CITY_PICKER_VIEW.LIST
  );

  const close = () => router.back();

  return (
    <Background>
      <ScreenHeader
        title={t(TITLES[view])}
        back={{ fallback: BACK_DESTINATION.SETTINGS_LOCATION }}
      />

      {view === CITY_PICKER_VIEW.LIST ? (
        <CityPicker
          onDone={close}
          onEnterCoordinates={() => setView(CITY_PICKER_VIEW.COORDINATES)}
        />
      ) : (
        <CoordinateEntry onDone={close} />
      )}
    </Background>
  );
};

export default LocationPickerScreen;

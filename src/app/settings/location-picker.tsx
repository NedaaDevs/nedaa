import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { useState } from "react";
import { router } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";

const PickerMode = {
  SEARCH: "search",
  COORDINATES: "coordinates",
} as const;

type PickerModeValue = (typeof PickerMode)[keyof typeof PickerMode];

const TITLES: Record<PickerModeValue, ParseKeys> = {
  [PickerMode.SEARCH]: "location.picker.title",
  [PickerMode.COORDINATES]: "location.coordinates.title",
};

const LocationPickerScreen = () => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<PickerModeValue>(PickerMode.SEARCH);

  const close = () => router.back();

  return (
    <Background>
      <ScreenHeader
        title={t(TITLES[mode])}
        back={{ fallback: BACK_DESTINATION.SETTINGS_LOCATION }}
      />

      {mode === PickerMode.SEARCH ? (
        <CityPicker onDone={close} onEnterCoordinates={() => setMode(PickerMode.COORDINATES)} />
      ) : (
        <CoordinateEntry onDone={close} />
      )}
    </Background>
  );
};

export default LocationPickerScreen;

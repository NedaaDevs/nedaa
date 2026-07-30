import { useState } from "react";
import { router } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";

const PickerMode = {
  SEARCH: "search",
  COORDINATES: "coordinates",
} as const;

type PickerModeValue = (typeof PickerMode)[keyof typeof PickerMode];

const TITLES: Record<PickerModeValue, string> = {
  [PickerMode.SEARCH]: "location.picker.title",
  [PickerMode.COORDINATES]: "location.coordinates.title",
};

const LocationPickerScreen = () => {
  const [mode, setMode] = useState<PickerModeValue>(PickerMode.SEARCH);

  const close = () => router.back();

  return (
    <Background>
      <TopBar title={TITLES[mode]} href="/settings/location" backOnClick />

      {mode === PickerMode.SEARCH ? (
        <CityPicker onDone={close} onEnterCoordinates={() => setMode(PickerMode.COORDINATES)} />
      ) : (
        <CoordinateEntry onDone={close} />
      )}
    </Background>
  );
};

export default LocationPickerScreen;

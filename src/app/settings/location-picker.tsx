import { router } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import CityPicker from "@/components/location/CityPicker";

const LocationPickerScreen = () => (
  <Background>
    <TopBar title="location.picker.title" href="/settings/location" backOnClick />
    <CityPicker onDone={() => router.back()} />
  </Background>
);

export default LocationPickerScreen;

// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import Location from "@/components/Location";

const LocationSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.location.title" href="/settings" backOnClick />
      <Location />
    </Background>
  );
};

export default LocationSettings;

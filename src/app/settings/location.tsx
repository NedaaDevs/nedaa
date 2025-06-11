// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import Location from "@/components/Location";

const LocationSettings = () => {
  return (
    <Background>
      <TopBar title="settings.location.title" href="/" backOnClick />
      <Location />
    </Background>
  );
};

export default LocationSettings;

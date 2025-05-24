// Components
import { Box } from "@/components/ui/box";
import TopBar from "@/components/TopBar";
import Location from "@/components/Location";

const LocationSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-slate-900">
      <TopBar title="settings.location.title" href="/" backOnClick />
      <Location />
    </Box>
  );
};

export default LocationSettings;

// Components
import { Box } from "@/components/ui/box";
import ConcatUs from "@/components/ContactUs";
import TopBar from "@/components/TopBar";

const HelpSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-black">
      <TopBar title="settings.help.title" href="/" backOnClick />
      <ConcatUs />
    </Box>
  );
};

export default HelpSettings;

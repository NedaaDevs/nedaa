// Components
import { Box } from "@/components/ui/box";
import ThemeList from "@/components/ThemeList";
import TopBar from "@/components/TopBar";

const ThemeSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-black">
      <TopBar title="settings.appearance" href="/" backOnClick />
      <ThemeList />
    </Box>
  );
};

export default ThemeSettings;

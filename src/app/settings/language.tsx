// Components
import { Box } from "@/components/ui/box";
import LanguageList from "@/components/LanguageList";
import TopBar from "@/components/TopBar";

const LanguageSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-black">
      <TopBar title="language" href="/" backOnClick />
      <LanguageList />
    </Box>
  );
};

export default LanguageSettings;

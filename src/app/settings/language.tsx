// Components
import { Box } from "@/components/ui/box";
import LanguageList from "@/components/LanguageList";
import TopBar from "@/components/TopBar";

const LanguageSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-slate-900">
      <TopBar title="settings.language" href="/" backOnClick />
      <LanguageList />
    </Box>
  );
};

export default LanguageSettings;

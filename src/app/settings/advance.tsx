// Components
import { Box } from "@/components/ui/box";

import TopBar from "@/components/TopBar";
import ProviderSettings from "@/components/ProviderSettings";

const AdvanceSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-slate-900">
      <TopBar title="settings.advance.title" href="/" backOnClick />
      <ProviderSettings />
    </Box>
  );
};

export default AdvanceSettings;

// Components
import { Background } from "@/components/ui/background";

import TopBar from "@/components/TopBar";
import { ProviderSettings } from "@/components/ProviderSettings";

const AdvanceSettings = () => {
  return (
    <Background>
      <TopBar title="settings.advance.title" href="/settings/advance" backOnClick />
      <ProviderSettings />
    </Background>
  );
};

export default AdvanceSettings;

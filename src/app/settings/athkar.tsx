// Components
import { Background } from "@/components/ui/background";

import { ScreenHeader } from "@/components/ui/screen-header";
import Settings from "@/components/athkar/Settings";

const AthkarSettings = () => {
  return (
    <Background>
      <ScreenHeader title="settings.athkar.title" backOnClick />
      <Settings />
    </Background>
  );
};

export default AthkarSettings;

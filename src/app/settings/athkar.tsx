// Components
import { Background } from "@/components/ui/background";

import TopBar from "@/components/TopBar";
import Settings from "@/components/athkar/Settings";

const AthkarSettings = () => {
  return (
    <Background>
      <TopBar title="settings.athkar.title" backOnClick />
      <Settings />
    </Background>
  );
};

export default AthkarSettings;

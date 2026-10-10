import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";

import { ScreenHeader } from "@/components/ui/screen-header";
import Settings from "@/components/athkar/Settings";

const AthkarSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader title={t("settings.athkar.title")} back />
      <Settings />
    </Background>
  );
};

export default AthkarSettings;

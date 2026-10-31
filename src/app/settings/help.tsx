import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";
import ConcatUs from "@/components/ContactUs";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

const HelpSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader
        title={t("settings.help.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS_ABOUT }}
      />
      <ConcatUs />
    </Background>
  );
};

export default HelpSettings;

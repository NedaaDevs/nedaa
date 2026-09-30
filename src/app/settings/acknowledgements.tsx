import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";
import Acknowledgements from "@/components/Acknowledgements";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

const AcknowledgementsSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader
        title={t("settings.acknowledgements.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS_ABOUT }}
      />
      <Acknowledgements />
    </Background>
  );
};

export default AcknowledgementsSettings;

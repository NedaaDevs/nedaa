import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";
import LanguageList from "@/components/LanguageList";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

const LanguageSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader title={t("settings.language")} back={{ fallback: BACK_DESTINATION.SETTINGS }} />
      <LanguageList />
    </Background>
  );
};

export default LanguageSettings;

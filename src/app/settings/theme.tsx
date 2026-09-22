import { useTranslation } from "react-i18next";
// Components
import { Background } from "@/components/ui/background";
import ThemeList from "@/components/ThemeList";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

const ThemeSettings = () => {
  const { t } = useTranslation();

  return (
    <Background>
      <ScreenHeader
        title={t("settings.appearance")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />
      <ThemeList />
    </Background>
  );
};

export default ThemeSettings;

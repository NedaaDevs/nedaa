// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";

import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import SettingsItem from "@/components/SettingsItem";

const AdvanceSettings = () => {
  const { t } = useTranslation();
  return (
    <Background>
      <ScreenHeader
        title={t("settings.advance.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />
      <SettingsItem name={t("settings.advance.provider.title")} path="/settings/advance/provider" />
      <Divider />
      <SettingsItem name={t("settings.advance.hijri.title")} path="/settings/advance/hijri" />
    </Background>
  );
};

export default AdvanceSettings;

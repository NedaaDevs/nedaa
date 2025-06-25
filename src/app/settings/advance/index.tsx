// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";

import TopBar from "@/components/TopBar";
import { ProviderSettings } from "@/components/ProviderSettings";
import SettingsItem from "@/components/SettingsItem";

const AdvanceSettings = () => {
  const { t } = useTranslation();
  return (
    <Background>
      <TopBar title="settings.advance.title" href="/settings" backOnClick />
      <SettingsItem name={t("settings.advance.provider.title")} path="/settings/advance/provider" />
    </Background>
  );
};

export default AdvanceSettings;

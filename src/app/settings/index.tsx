import { ScrollView } from "react-native";

// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Divider } from "@/components/ui/divider";

import TopBar from "@/components/TopBar";

// Icons
import { Languages, ArrowRight } from "lucide-react-native";
import SettingsItem from "@/components/SettingsItem";

const SettingsScreen = () => {
  const { t } = useTranslation();
  return (
    <ScrollView className="bg-grey dark:bg-black" contentContainerStyle={{ flexGrow: 1 }}>
      <TopBar title={t("settings")} href="/" icon={ArrowRight} backOnClick />

      {/* Language */}
      <SettingsItem name={t("language")} path="/settings/language" icon={Languages} />
      <Divider className="bg-primary dark:bg-secondary mx-2" />
    </ScrollView>
  );
};

export default SettingsScreen;

import { ScrollView } from "react-native";

// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Divider } from "@/components/ui/divider";

import TopBar from "@/components/TopBar";

// Icons
import { Languages, Palette } from "lucide-react-native";
import SettingsItem from "@/components/SettingsItem";

const SettingsScreen = () => {
  const { t } = useTranslation();
  return (
    <ScrollView className="bg-grey dark:bg-black" contentContainerStyle={{ flexGrow: 1 }}>
      <TopBar title="settings" href="/" backOnClick />

      {/* Language */}
      <SettingsItem name={t("language")} path="/settings/language" icon={Languages} />
      <Divider className="bg-primary/30 dark:bg-secondary/30 mx-4 w-[calc(100%-32px)]" />
      {/* Theme */}
      <SettingsItem name={t("appearance")} path="/settings/theme" icon={Palette} />
    </ScrollView>
  );
};

export default SettingsScreen;

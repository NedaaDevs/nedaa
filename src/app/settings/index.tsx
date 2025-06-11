import { ScrollView } from "react-native";

// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";
import TopBar from "@/components/TopBar";
import SettingsItem from "@/components/SettingsItem";
import SettingsFooter from "@/components/SettingsFooter";

// Icons
import {
  Languages,
  Palette,
  CircleHelp,
  MapPin,
  Settings2Icon,
  BellRing,
} from "lucide-react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { locale, mode } = useAppStore();
  const { localizedLocation } = useLocationStore();
  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <TopBar title="settings.title" href="/" backOnClick />

        {/* Language */}
        <SettingsItem
          name={t("settings.language")}
          path="/settings/language"
          icon={Languages}
          currentValue={t(`settings.languages.${locale}.nativeTitle`)}
        />
        <Divider className="bg-primary/30 dark:bg-secondary/30 mx-4 w-[calc(100%-32px)]" />
        {/* Theme */}
        <SettingsItem
          name={t("settings.appearance")}
          path="/settings/theme"
          icon={Palette}
          currentValue={t(`settings.themes.${mode}.title`)}
        />

        {/* Notification */}
        <SettingsItem
          name={t("settings.notification.title")}
          path="/settings/notification"
          icon={BellRing}
        />

        {/* Location */}
        <SettingsItem
          name={t("settings.location.title")}
          path="/settings/location"
          icon={MapPin}
          currentValue={localizedLocation.city ?? ""}
        />

        {/* Advance */}
        <SettingsItem
          name={t("settings.advance.title")}
          path="/settings/advance"
          icon={Settings2Icon}
        />

        {/* Help */}
        <SettingsItem name={t("settings.help.title")} path="/settings/help" icon={CircleHelp} />

        {/* Footer */}
        <SettingsFooter />
      </ScrollView>
    </Background>
  );
};

export default SettingsScreen;

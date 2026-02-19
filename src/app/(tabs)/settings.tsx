import { useState, useEffect } from "react";
import { Platform, ScrollView } from "react-native";

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
  Monitor,
  CircleHelp,
  MapPin,
  Settings2Icon,
  BellRing,
  BookOpen,
  AlarmClock,
  LayoutGrid,
} from "lucide-react-native";

import { isPinningSupported } from "expo-widgets";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Services
import ExpoAlarm from "expo-alarm";
import { PlatformType } from "@/enums/app";

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { locale, mode } = useAppStore();
  const { localizedLocation } = useLocationStore();
  const [alarmAvailable, setAlarmAvailable] = useState(false);

  useEffect(() => {
    ExpoAlarm.isAlarmKitAvailable().then(setAlarmAvailable);
  }, []);
  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <TopBar title="settings.title" backOnClick />

        {/* Language */}
        <SettingsItem
          name={t("settings.language")}
          path="/settings/language"
          icon={Languages}
          currentValue={t(`settings.languages.${locale}.nativeTitle`)}
        />
        <Divider marginHorizontal="$4" />
        {/* Theme */}
        <SettingsItem
          name={t("settings.appearance")}
          path="/settings/theme"
          icon={Palette}
          currentValue={t(`settings.themes.${mode}.title`)}
        />
        <Divider marginHorizontal="$4" />
        {/* Display */}
        <SettingsItem name={t("settings.display.title")} path="/settings/display" icon={Monitor} />
        <Divider marginHorizontal="$4" />

        {/* Notification */}
        <SettingsItem
          name={t("settings.notification.title")}
          path="/settings/notification"
          icon={BellRing}
        />

        {/* Alarm Settings — iOS 26+ (AlarmKit) or Android */}
        {(Platform.OS === PlatformType.ANDROID || alarmAvailable) && (
          <SettingsItem
            name={t("alarm.settings.title")}
            path={"/settings/alarm" as any}
            icon={AlarmClock}
          />
        )}

        {/* Location */}
        <SettingsItem
          name={t("settings.location.title")}
          path="/settings/location"
          icon={MapPin}
          currentValue={localizedLocation.city ?? ""}
        />

        {/* Athkar Settings - Only show for supported locales */}
        {isAthkarSupported(locale) && (
          <SettingsItem name={t("settings.athkar.title")} path="/settings/athkar" icon={BookOpen} />
        )}

        {/* Widgets (Android with pinning support only) */}
        {Platform.OS === PlatformType.ANDROID && isPinningSupported() && (
          <SettingsItem
            name={t("settings.widgets.title")}
            path={"/settings/widgets" as any}
            icon={LayoutGrid}
          />
        )}

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

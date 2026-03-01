import { useState, useEffect } from "react";
import { Linking, Platform, ScrollView, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

// Plugins
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
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
  Star,
  Share2,
} from "lucide-react-native";

import { isPinningSupported } from "expo-widgets";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { useToastStore } from "@/stores/toast";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Constants
import { STORE_LINKS } from "@/constants/StoreLinks";

// Services
import ExpoAlarm from "expo-alarm";
import { PlatformType } from "@/enums/app";

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { locale, mode } = useAppStore();
  const { localizedLocation } = useLocationStore();
  const [alarmAvailable, setAlarmAvailable] = useState(false);
  const hapticMedium = useHaptic("medium");

  useEffect(() => {
    ExpoAlarm.isAlarmKitAvailable().then(setAlarmAvailable);
  }, []);

  const handleRate = () => {
    hapticMedium();
    const url = Platform.OS === PlatformType.IOS ? STORE_LINKS.iosReview : STORE_LINKS.android;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === PlatformType.ANDROID) {
        Linking.openURL(STORE_LINKS.androidFallback);
      }
    });
  };

  const handleShare = () => {
    hapticMedium();
    Share.share({ message: t("settings.shareMessage") });
  };

  const handleShareLongPress = async () => {
    hapticMedium();
    await Clipboard.setStringAsync(STORE_LINKS.share);
    useToastStore.getState().showToast(t("settings.linkCopied"), "success");
  };
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
        {/* Theme */}
        <SettingsItem
          name={t("settings.appearance")}
          path="/settings/theme"
          icon={Palette}
          currentValue={t(`settings.themes.${mode}.title`)}
        />
        {/* Display */}
        <SettingsItem name={t("settings.display.title")} path="/settings/display" icon={Monitor} />

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

        {/* Rate & Share */}
        <HStack marginHorizontal="$2" marginTop="$2" gap="$2">
          <Box flex={1} padding="$4" borderRadius="$4" backgroundColor="$backgroundSecondary">
            <Pressable onPress={handleRate} alignItems="center" justifyContent="center" gap="$2">
              <Icon color="$warning" size="lg" as={Star} />
              <Text size="md" fontWeight="500" color="$typography">
                {t("settings.rateApp")}
              </Text>
            </Pressable>
          </Box>
          <Box flex={1} padding="$4" borderRadius="$4" backgroundColor="$backgroundSecondary">
            <Pressable
              onPress={handleShare}
              onLongPress={handleShareLongPress}
              alignItems="center"
              justifyContent="center"
              gap="$2">
              <Icon color="$accentPrimary" size="lg" as={Share2} />
              <Text size="md" fontWeight="500" color="$typography">
                {t("settings.shareApp")}
              </Text>
            </Pressable>
          </Box>
        </HStack>

        {/* Footer */}
        <SettingsFooter />
      </ScrollView>
    </Background>
  );
};

export default SettingsScreen;

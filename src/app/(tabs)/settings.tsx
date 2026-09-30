import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, Linking, Platform, ScrollView, Share } from "react-native";
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";

// Plugins
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/ui/theme-color";

// Components
import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { ScreenHeader } from "@/components/ui/screen-header";
import SettingsItem from "@/components/SettingsItem";

// Icons
import {
  Languages,
  Palette,
  Monitor,
  MapPin,
  Settings2Icon,
  BellRing,
  BookOpen,
  AlarmClock,
  LayoutGrid,
  Star,
  Share2,
  Heart,
  Music,
  Info,
} from "lucide-react-native";

import { isPinningSupported } from "expo-widgets";

// Hooks
import { useAlarmSupported } from "@/hooks/useAlarmSupported";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { MessageToast } from "@/components/feedback/MessageToast";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Constants
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { STORE_LINKS } from "@/constants/StoreLinks";

// Services
import { PlatformType } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const THANK_YOU_DURATION = 2000;
const FADE_MS = 200;

const SettingsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, mode } = useAppStore();
  const { localizedLocation } = useLocationStore();
  const alarmSupported = useAlarmSupported();
  const hapticMedium = useHaptic("medium");

  const [rateThanked, setRateThanked] = useState(false);
  const [shareThanked, setShareThanked] = useState(false);
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(false);
  // Mirror into a ref for the animation callbacks; writing in an effect (not
  // during render) keeps it React-compiler safe.
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rateOpacity = useSharedValue(1);
  const rateThanksOpacity = useSharedValue(0);
  const rateHeartFill = useSharedValue(0);
  const shareOpacity = useSharedValue(1);
  const shareThanksOpacity = useSharedValue(0);
  const shareHeartFill = useSharedValue(0);

  const rateStyle = useAnimatedStyle(() => ({ opacity: rateOpacity.get() }));
  const rateThanksStyle = useAnimatedStyle(() => ({ opacity: rateThanksOpacity.get() }));
  const rateHeartFillStyle = useAnimatedStyle(() => ({ opacity: rateHeartFill.get() }));
  const shareStyle = useAnimatedStyle(() => ({ opacity: shareOpacity.get() }));
  const shareThanksStyle = useAnimatedStyle(() => ({ opacity: shareThanksOpacity.get() }));
  const shareHeartFillStyle = useAnimatedStyle(() => ({ opacity: shareHeartFill.get() }));

  useEffect(() => {
    const timers = timersRef;
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const showThankYou = useCallback(
    (
      mainOpacity: SharedValue<number>,
      thanksOpacity: SharedValue<number>,
      heartFill: SharedValue<number>,
      setThanked: (v: boolean) => void
    ) => {
      const dur = reduceMotionRef.current ? 0 : FADE_MS;
      setThanked(true);
      mainOpacity.set(withTiming(0, { duration: dur }));
      thanksOpacity.set(withTiming(1, { duration: dur }));
      heartFill.set(0);
      heartFill.set(withTiming(1, { duration: reduceMotionRef.current ? 0 : THANK_YOU_DURATION }));

      const t1 = setTimeout(() => {
        mainOpacity.set(withTiming(1, { duration: dur }));
        thanksOpacity.set(withTiming(0, { duration: dur }));
        const t2 = setTimeout(() => {
          setThanked(false);
          heartFill.set(0);
        }, dur);
        timersRef.current.push(t2);
      }, THANK_YOU_DURATION);
      timersRef.current.push(t1);
    },
    []
  );

  const handleRate = () => {
    if (rateThanked) return;
    hapticMedium();
    const url = Platform.OS === PlatformType.IOS ? STORE_LINKS.iosReview : STORE_LINKS.android;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === PlatformType.ANDROID) Linking.openURL(STORE_LINKS.androidFallback);
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sub.remove();
        showThankYou(rateOpacity, rateThanksOpacity, rateHeartFill, setRateThanked);
      }
    });
  };

  const handleShare = () => {
    if (shareThanked) return;
    hapticMedium();

    if (Platform.OS === PlatformType.ANDROID) {
      Share.share({ message: t("settings.shareMessage") });
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          sub.remove();
          showThankYou(shareOpacity, shareThanksOpacity, shareHeartFill, setShareThanked);
        }
      });
    } else {
      Share.share({ message: t("settings.shareMessage") }).then((result) => {
        if (result.action === Share.dismissedAction) return;
        showThankYou(shareOpacity, shareThanksOpacity, shareHeartFill, setShareThanked);
      });
    }
  };

  const handleShareLongPress = async () => {
    hapticMedium();
    await Clipboard.setStringAsync(STORE_LINKS.share);
    MessageToast.showSuccess(t("settings.linkCopied"));
  };
  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader title={t("settings.title")} back />

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
        <SettingsItem
          name={t("settings.preferences.title")}
          path="/settings/preferences"
          icon={Monitor}
        />

        {/* Notification */}
        <SettingsItem
          name={t("settings.notification.title")}
          path="/settings/notification"
          icon={BellRing}
        />

        {/* Alarm Settings — iOS needs AlarmKit; Android always has it */}
        {alarmSupported && (
          <SettingsItem
            name={t("alarm.settings.title")}
            path={"/settings/alarm" as any}
            icon={AlarmClock}
          />
        )}

        {/* Custom Sounds — Android only; shared by notifications and alarms, so it
        sits beside them rather than inside either one. */}
        {Platform.OS === PlatformType.ANDROID && (
          <SettingsItem
            name={t("notification.customSound.title")}
            path={"/settings/customSounds" as any}
            icon={Music}
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

        {/* Widgets — iOS always (add-instructions + manual refresh); Android only
        with pinning support (the screen is built around pin cards there). */}
        {(Platform.OS === PlatformType.IOS ||
          (Platform.OS === PlatformType.ANDROID && isPinningSupported())) && (
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

        <SettingsItem
          name={t(BACK_DESTINATION.SETTINGS_ABOUT.title)}
          path={BACK_DESTINATION.SETTINGS_ABOUT.href}
          icon={Info}
        />

        {/* Rate & Share */}
        <HStack marginHorizontal="$2" marginTop="$2" gap="$2">
          <Card flex={1}>
            <Pressable
              onPress={handleRate}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              accessibilityRole="button"
              accessibilityLabel={rateThanked ? t("settings.thankYou") : t("settings.rateApp")}>
              <Animated.View
                style={[rateStyle, { alignItems: "center", gap: 8 }]}
                pointerEvents={rateThanked ? "none" : "auto"}>
                <Icon color="$warning" size="lg" as={Star} />
                <Text size="md" fontWeight="500" color="$typography">
                  {t("settings.rateApp")}
                </Text>
              </Animated.View>
              {rateThanked && (
                <Animated.View
                  style={[rateThanksStyle, { position: "absolute", alignItems: "center", gap: 8 }]}>
                  <Box width={20} height={20}>
                    <Heart size={20} color={theme.error.val} fill="none" />
                    <Animated.View style={[rateHeartFillStyle, { position: "absolute" }]}>
                      <Heart size={20} color={theme.error.val} fill={theme.error.val} />
                    </Animated.View>
                  </Box>
                  <Text size="md" fontWeight="500" color="$typography">
                    {t("settings.thankYou")}
                  </Text>
                </Animated.View>
              )}
            </Pressable>
          </Card>
          <Card flex={1}>
            <Pressable
              onPress={handleShare}
              onLongPress={handleShareLongPress}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              accessibilityRole="button"
              accessibilityLabel={shareThanked ? t("settings.thankYou") : t("settings.shareApp")}>
              <Animated.View
                style={[shareStyle, { alignItems: "center", gap: 8 }]}
                pointerEvents={shareThanked ? "none" : "auto"}>
                <Icon color="$accentPrimary" size="lg" as={Share2} />
                <Text size="md" fontWeight="500" color="$typography">
                  {t("settings.shareApp")}
                </Text>
              </Animated.View>
              {shareThanked && (
                <Animated.View
                  style={[
                    shareThanksStyle,
                    { position: "absolute", alignItems: "center", gap: 8 },
                  ]}>
                  <Box width={20} height={20}>
                    <Heart size={20} color={theme.error.val} fill="none" />
                    <Animated.View style={[shareHeartFillStyle, { position: "absolute" }]}>
                      <Heart size={20} color={theme.error.val} fill={theme.error.val} />
                    </Animated.View>
                  </Box>
                  <Text size="md" fontWeight="500" color="$typography">
                    {t("settings.thankYou")}
                  </Text>
                </Animated.View>
              )}
            </Pressable>
          </Card>
        </HStack>
      </ScrollView>
    </Background>
  );
};

export default SettingsScreen;

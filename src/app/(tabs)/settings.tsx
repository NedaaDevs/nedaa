import { useState, useEffect, useCallback, useRef } from "react";
import { AccessibilityInfo, AppState, Linking, Platform, ScrollView, Share } from "react-native";
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";

// Plugins
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";

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
  Heart,
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

const THANK_YOU_DURATION = 2000;
const FADE_MS = 200;

const SettingsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, mode } = useAppStore();
  const { localizedLocation } = useLocationStore();
  const [alarmAvailable, setAlarmAvailable] = useState(false);
  const hapticMedium = useHaptic("medium");

  const [rateThanked, setRateThanked] = useState(false);
  const [shareThanked, setShareThanked] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const reduceMotionRef = useRef(false);
  reduceMotionRef.current = reduceMotion;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rateOpacity = useSharedValue(1);
  const rateThanksOpacity = useSharedValue(0);
  const rateHeartFill = useSharedValue(0);
  const shareOpacity = useSharedValue(1);
  const shareThanksOpacity = useSharedValue(0);
  const shareHeartFill = useSharedValue(0);

  const rateStyle = useAnimatedStyle(() => ({ opacity: rateOpacity.value }));
  const rateThanksStyle = useAnimatedStyle(() => ({ opacity: rateThanksOpacity.value }));
  const rateHeartFillStyle = useAnimatedStyle(() => ({ opacity: rateHeartFill.value }));
  const shareStyle = useAnimatedStyle(() => ({ opacity: shareOpacity.value }));
  const shareThanksStyle = useAnimatedStyle(() => ({ opacity: shareThanksOpacity.value }));
  const shareHeartFillStyle = useAnimatedStyle(() => ({ opacity: shareHeartFill.value }));

  useEffect(() => {
    ExpoAlarm.isAlarmKitAvailable().then(setAlarmAvailable);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
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
      mainOpacity.value = withTiming(0, { duration: dur });
      thanksOpacity.value = withTiming(1, { duration: dur });
      heartFill.value = 0;
      heartFill.value = withTiming(1, {
        duration: reduceMotionRef.current ? 0 : THANK_YOU_DURATION,
      });

      const t1 = setTimeout(() => {
        mainOpacity.value = withTiming(1, { duration: dur });
        thanksOpacity.value = withTiming(0, { duration: dur });
        const t2 = setTimeout(() => {
          setThanked(false);
          heartFill.value = 0;
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
          </Box>
          <Box flex={1} padding="$4" borderRadius="$4" backgroundColor="$backgroundSecondary">
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
          </Box>
        </HStack>

        {/* Footer */}
        <SettingsFooter />
      </ScrollView>
    </Background>
  );
};

export default SettingsScreen;

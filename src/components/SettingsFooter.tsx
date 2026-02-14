import * as Application from "expo-application";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

// Components
import CrashLogButton from "@/components/CrashLogButton";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";

import { useThemeName } from "tamagui";

const logoLight = require("../../assets/images/icon.png");
const logoDark = require("../../assets/images/ios-dark.png");

const SettingsFooter = () => {
  const { t } = useTranslation();
  const themeName = useThemeName();

  const appVersion =
    Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0";

  const buildNumber =
    Application.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || "1";

  const logo = themeName === "dark" ? logoDark : logoLight;

  const openWebsite = async () => {
    const websiteUrl = process.env.EXPO_PUBLIC_WEBSITE ?? "";

    const canOpen = await Linking.canOpenURL(websiteUrl);

    if (canOpen) {
      await Linking.openURL(websiteUrl);
    }
  };

  return (
    <Box alignItems="center" justifyContent="center" paddingVertical="$8" marginTop="auto">
      <Pressable
        onPress={openWebsite}
        accessibilityRole="button"
        accessibilityLabel={t("common.visitWebsite")}>
        <Image accessibilityLabel={t("common.logo")} source={logo} size="xs" marginBottom="$4" />
      </Pressable>

      <Text size="lg" color="$typographySecondary" textAlign="center" marginBottom="$2">
        {appVersion} ({buildNumber})
      </Text>

      <CrashLogButton />
    </Box>
  );
};

export default SettingsFooter;

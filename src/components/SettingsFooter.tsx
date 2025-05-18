import React from "react";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";

// Components
import CrashLogButton from "@/components/CrashLogButton";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";

// Hooks
import { useColorScheme } from "nativewind";

// Enums
import { AppMode } from "@/enums/app";
import { Linking } from "react-native";

const logoLight = require("../../assets/images/icon.png");
const logoDark = require("../../assets/images/ios-dark.png");

const SettingsFooter = () => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  const appVersion =
    Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0";

  const buildNumber =
    Application.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || "1";

  const logo = colorScheme.colorScheme === AppMode.DARK ? logoDark : logoLight;

  const openWebsite = async () => {
    const websiteUrl = process.env.EXPO_PUBLIC_WEBSITE ?? "";

    // Check if the URL can be opened
    const canOpen = await Linking.canOpenURL(websiteUrl);

    if (canOpen) {
      await Linking.openURL(websiteUrl);
    }
  };

  return (
    <Box className="items-center justify-center py-8 mt-auto">
      <Pressable
        onPress={openWebsite}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("common.visitWebsite")}>
        <Image alt={t("common.logo")} source={logo} size="xs" className="mb-4" />
      </Pressable>

      {/* Version and build number */}
      <Text className="text-center text-lg text-typography/70 dark:text-tertiary/70 mb-2">
        {appVersion} ({buildNumber})
      </Text>

      {/* Crash Log Toggle */}
      <CrashLogButton />
    </Box>
  );
};

export default SettingsFooter;

import React from "react";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";

// Components
import CrashLogButton from "@/components/CrashLogButton";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Image } from "@/components/ui/image";

// Hooks
import { useColorScheme } from "nativewind";

// Enums
import { AppMode } from "@/enums/app";

const logoLight = require("../../assets/images/ios-light.png");
const logoDark = require("../../assets/images/ios-dark.png");

const SettingsFooter = () => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  const appVersion =
    Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0";

  const buildNumber =
    Application.nativeBuildVersion || Constants.expoConfig?.ios?.buildNumber || "1";

  const logo = colorScheme.colorScheme === AppMode.DARK ? logoDark : logoLight;

  return (
    <Box className="items-center justify-center py-8 mt-auto">
      <Image alt={t("common.logo")} source={logo} size="xs" className="mb-4" />

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

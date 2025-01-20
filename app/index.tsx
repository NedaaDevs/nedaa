// Stores
import { useAppStore } from "@/stores/app";

// Enums
import { AppLocale, AppMode } from "@/enums/app";

import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import React from "react";
import { Divider } from "@/components/ui/divider";
import { Center } from "@/components/ui/center";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabOneScreen() {
  const { locale, mode, setLocale, setMode, setIsFirstRun } = useAppStore();

  const { t, i18n } = useTranslation();

  const toggleMode = () => {
    const modes = Object.values(AppMode);

    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const toggleLanguage = () => {
    // Simulate how is should be done
    setIsFirstRun(false);
    const languages = Object.values(AppLocale);

    const currentIndex = languages.indexOf(locale);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLocale(languages[nextIndex]);
    i18n.changeLanguage(languages[nextIndex]);
  };
  return (
    <SafeAreaView>
      <Text className="bg-primary">
        {t("deviceLocale")}: {t(`localeOptions.${locale}`)}
      </Text>
      <Box>
        <Button onPress={toggleLanguage}>
          <ButtonText>{t("toggleLanguage")}</ButtonText>
        </Button>
      </Box>
      <Divider />
      <Text className="bg-background-new">
        {t("mode")}: {mode}
      </Text>
      <Center>
        <Box className="bg-primary flex-1">
          <Button action="primary" onPress={toggleMode}>
            <ButtonText>{t("toggleMode")}</ButtonText>
          </Button>
        </Box>
      </Center>
    </SafeAreaView>
  );
}

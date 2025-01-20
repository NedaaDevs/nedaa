import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { I18nManager, View, Text as T, StyleSheet } from "react-native";

// Stores
import { useAppStore } from "@/stores/app";

// Enums
import { AppLocale, AppMode } from "@/enums/app";

import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Divider } from "@/components/ui/divider";
import { Center } from "@/components/ui/center";

export default function MainScreen() {
  const { locale, mode, setLocale, setMode, setIsFirstRun } = useAppStore();

  const { t } = useTranslation();

  const toggleMode = () => {
    const modes = Object.values(AppMode);

    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const toggleLanguage = () => {
    // Simulate how is should be done
    setIsFirstRun(false);
    const languages = Object.values(AppLocale).splice(0, 2);

    const currentIndex = languages.indexOf(locale);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLocale(languages[nextIndex]);
  };
  return (
    <SafeAreaView className="flex-1 bg-white px-4">
      <View className="mt-5 mb-4">
        <Text className="text-lg font-semibold text-gray-800 mb-3 text-left">
          {t("deviceLocale")}: {t(`localeOptions.${locale}`)}
        </Text>

        <Button
          className="rounded-lg py-4 bg-primary shadow-md active:opacity-80 h-14 min-h-[56px]"
          onPress={toggleLanguage}
        >
          <ButtonText className="text-base font-medium text-center w-full px-4">
            {t("toggleLanguage")}
          </ButtonText>
        </Button>
      </View>

      <Divider className="h-px bg-gray-200 my-5" />

      <View className="mt-2">
        <Text className="text-base text-gray-600 mb-4 text-start">
          {t("mode")}: {mode}
        </Text>

        <Center>
          <Box className="w-full px-1 mt-2">
            <Button
              action="primary"
              className="rounded-lg py-2 bg-blue-500 shadow-md active:opacity-80"
              onPress={toggleMode}
            >
              <ButtonText className="text-base font-medium text-start text-white">
                {t("toggleMode")}
              </ButtonText>
            </Button>
          </Box>
        </Center>
      </View>

      <View style={styles.container}>
        <T style={styles.paragraph}> {I18nManager.isRTL ? " RTL" : " LTR"}</T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 8,
  },
  paragraph: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "left",
    width: "50%",
    backgroundColor: "pink",
  },
});

import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { I18nManager, Text as T, View, StyleSheet } from "react-native";

import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";

import { AppLocale, AppMode } from "@/enums/app";
import { LocalPermissionStatus } from "@/types/notifications";

import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Divider } from "@/components/ui/divider";

export default function MainScreen() {
  const { locale, mode, setLocale, setMode } = useAppStore();
  const { permissions, openSystemSettings, checkPermissions } =
    useNotificationStore();
  const { t } = useTranslation();

  const toggleMode = () => {
    const modes = Object.values(AppMode);
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const toggleLanguage = () => {
    const languages = Object.values(AppLocale);
    const currentIndex = languages.indexOf(locale);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLocale(languages[nextIndex]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background-50">
      <Box className="px-4 py-5 space-y-8">
        <Box>
          <Box className="flex-row items-center space-x-2 mb-4">
            <Text className="text-xl font-bold text-typography-800">
              {t("deviceLocale")}:
            </Text>
            <Text className="text-xl font-semibold text-info-500">
              {t(`localeOptions.${locale}`)}
            </Text>
          </Box>

          <Button
            className="rounded-xl bg-info-400 shadow-lg active:opacity-80 h-14"
            onPress={toggleLanguage}
          >
            <ButtonText className="text-lg font-bold text-background-0 text-center w-full">
              {t("toggleLanguage")}
            </ButtonText>
          </Button>
        </Box>

        <Divider className="h-0.5 bg-outline-200" />

        <Box>
          <Box className="flex-row items-center space-x-2 mb-4">
            <Text className="text-xl font-bold text-typography-800">
              {t("mode")}
            </Text>
            <Text className="text-xl font-semibold text-info-500">
              {t(`modes.${mode}`)}
            </Text>
          </Box>

          <Button
            className="rounded-xl bg-info-400 shadow-lg active:opacity-80 h-14"
            onPress={toggleMode}
          >
            <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
              {t("toggleMode")}
            </ButtonText>
          </Button>
        </Box>

        <Box>
          <Box className="flex-row items-center space-x-2 mb-4">
            <Text className="text-xl font-bold text-typography-800">
              {t("notifications")}
            </Text>
            <Text
              className={`text-xl font-semibold ${
                permissions.status === LocalPermissionStatus.GRANTED
                  ? "text-success-500"
                  : permissions.status === LocalPermissionStatus.DENIED
                    ? "text-error-500"
                    : "text-warning-500"
              }`}
            >
              {t(`status.${permissions.status}`)}
            </Text>
          </Box>

          <Box className="space-y-10 mt-4">
            <Button
              className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14"
              onPress={openSystemSettings}
            >
              <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                {t("openSettings")}
              </ButtonText>
            </Button>

            <Button
              className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14 mt-5"
              onPress={async () => await checkPermissions()}
            >
              <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                {t("checkPermissions")}
              </ButtonText>
            </Button>
          </Box>
        </Box>
      </Box>

      <Divider />
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

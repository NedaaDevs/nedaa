import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { I18nManager, Text as T, View, StyleSheet } from "react-native";

import { useAppStore } from "@/stores/app";
import { useNotificationStore } from "@/stores/notification";
import { useLocationStore } from "@/stores/location";

import { AppLocale, AppMode } from "@/enums/app";
import { LocalPermissionStatus } from "@/enums/notifications";
import { LocalPermissionStatus as LocationPermissionStatus } from "@/enums/location";

import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Divider } from "@/components/ui/divider";

export default function MainScreen() {
  const { locale, mode, setLocale, setMode } = useAppStore();
  const {
    permissions: notificationPermission,
    openSystemSettings,
    checkPermissions: checkNotificationPermission,
    requestPermissions: requestNotificationPermission,
  } = useNotificationStore();
  const {
    permissions: locationPermission,
    checkPermissions: checkLocationPermissions,
    requestPermissions: requestLocationPermission,
  } = useLocationStore();
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

        <Divider className="h-1 bg-outline-200" />

        <Text className="text-2xl font-bold text-typography-800 mb-4 text-center">
          {t("permissions")}
        </Text>

        <Box>
          <Box className="space-y-4">
            <Box>
              <Box className="flex-row items-center space-x-2 mb-2">
                <Text className="text-xl font-bold text-typography-800">
                  {t("notifications")}
                </Text>
                <Text
                  className={`text-xl font-semibold ${
                    notificationPermission.status ===
                    LocalPermissionStatus.GRANTED
                      ? "text-success-500"
                      : notificationPermission.status ===
                          LocalPermissionStatus.DENIED
                        ? "text-error-500"
                        : "text-warning-500"
                  }`}
                >
                  {t(`status.${notificationPermission.status}`)}
                </Text>
              </Box>

              <Text className="text-sm text-typography-600 mb-4 text-left ">
                {t("canRequestAgain")}:{" "}
                {notificationPermission.canRequestAgain ? t("yes") : t("no")}
              </Text>

              <Box className="space-y-4">
                <Button
                  className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14"
                  onPress={async () => await checkNotificationPermission()}
                >
                  <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                    {t("checkPermissions")}
                  </ButtonText>
                </Button>

                {notificationPermission.canRequestAgain &&
                  notificationPermission.status !==
                    LocalPermissionStatus.GRANTED && (
                    <Button
                      className="rounded-xl bg-primary-400 shadow-lg active:opacity-80 h-14"
                      onPress={requestNotificationPermission}
                    >
                      <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                        {t("requestPermission")}
                      </ButtonText>
                    </Button>
                  )}
              </Box>
            </Box>

            <Divider className="h-0.5 bg-outline-200" />

            <Box>
              <Box className="flex-row items-center space-x-2 mb-2">
                <Text className="text-xl font-bold text-typography-800">
                  {t("location")}
                </Text>
                <Text
                  className={`text-xl font-semibold ${
                    locationPermission.status ===
                    LocationPermissionStatus.GRANTED
                      ? "text-success-500"
                      : locationPermission.status ===
                          LocationPermissionStatus.DENIED
                        ? "text-error-500"
                        : "text-warning-500"
                  }`}
                >
                  {t(`status.${locationPermission.status}`)}
                </Text>
              </Box>

              <Text className="text-sm text-left text-typography-600 mb-4">
                {t("canRequestAgain")}:{" "}
                {locationPermission.canRequestAgain ? t("yes") : t("no")}
              </Text>

              <Box className="space-y-4">
                <Button
                  className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14"
                  onPress={async () => await checkLocationPermissions()}
                >
                  <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                    {t("checkPermissions")}
                  </ButtonText>
                </Button>

                {locationPermission.canRequestAgain &&
                  locationPermission.status !==
                    LocationPermissionStatus.GRANTED && (
                    <Button
                      className="rounded-xl bg-primary-400 shadow-lg active:opacity-80 h-14"
                      onPress={requestLocationPermission}
                    >
                      <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
                        {t("requestPermission")}
                      </ButtonText>
                    </Button>
                  )}
              </Box>
            </Box>
          </Box>

          <Button
            className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14 mt-8"
            onPress={openSystemSettings}
          >
            <ButtonText className="text-lg font-bold text-center text-background-0 w-full">
              {t("openSettings")}
            </ButtonText>
          </Button>
        </Box>
      </Box>

      <Divider />
      <View style={styles.container}>
        <T style={styles.paragraph}> {I18nManager.isRTL ? "RTL" : "LTR"}</T>
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

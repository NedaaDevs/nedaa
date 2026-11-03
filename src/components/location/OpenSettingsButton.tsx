import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import { Button } from "@/components/ui/button";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

export const openAppSettings = () =>
  Linking.openSettings().catch((error: unknown) =>
    log.w("OpenSettings", `app settings failed to open: ${errorText(error)}`)
  );

/** The way to the app's page in Settings, where location access is given. */
export const OpenSettingsButton = () => {
  const { t } = useTranslation();
  const label = t("location.permission.openSettings");
  return (
    <Button
      onPress={openAppSettings}
      accessibilityLabel={label}
      accessibilityHint={t("a11y.location.openSettingsHint")}>
      <Button.Text>{label}</Button.Text>
    </Button>
  );
};

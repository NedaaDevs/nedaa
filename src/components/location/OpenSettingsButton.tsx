import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import { Button } from "@/components/ui/button";
import type { PairAction } from "@/components/ui/button-pair";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

export const openAppSettings = () =>
  Linking.openSettings().catch((error: unknown) =>
    log.w("OpenSettings", `app settings failed to open: ${errorText(error)}`)
  );

/** The way to the app's page in Settings, as an action a button pair draws. */
export const useOpenSettingsAction = (): PairAction => {
  const { t } = useTranslation();
  return {
    label: t("location.permission.openSettings"),
    hint: t("a11y.location.openSettingsHint"),
    onPress: () => void openAppSettings(),
  };
};

/** The way to the app's page in Settings, where location access is given. */
export const OpenSettingsButton = () => {
  const { label, hint, onPress } = useOpenSettingsAction();
  return (
    <Button onPress={onPress} accessibilityLabel={label} accessibilityHint={hint}>
      <Button.Text>{label}</Button.Text>
    </Button>
  );
};

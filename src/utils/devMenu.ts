import { registerDevMenuItems } from "expo-dev-menu";

import { DEBUG_COPY } from "@/constants/DebugScreens";
import { useAppStore } from "@/stores/app";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("app");

/** Adds the debug items to the dev menu, which a release build lacks. */
export const registerDevMenu = (): Promise<void> => {
  if (!__DEV__) return Promise.resolve();
  return registerDevMenuItems([
    {
      name: DEBUG_COPY.RESTART_ONBOARDING,
      callback: () => useAppStore.getState().restartOnboarding(),
      shouldCollapse: true,
    },
  ]).catch((error: unknown) => {
    log.w("DevMenu", `dev menu items not added: ${errorText(error)}`);
  });
};

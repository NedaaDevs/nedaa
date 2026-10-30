import { registerDevMenuItems } from "expo-dev-menu";

import { DEBUG_COPY } from "@/constants/DebugScreens";
import { useAppStore } from "@/stores/app";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import {
  clearCityCheckMemory,
  runCityCheckNow,
  showCityCheckMemory,
  showNamedCityChange,
  showUnnamedCityChange,
} from "@/utils/cityCheckDebug";
import { phoneZoneReadings } from "@/utils/phoneZone";

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
    {
      // A check needs a real move; these put an offer up at once.
      name: DEBUG_COPY.SHOW_CITY_CHANGE,
      callback: showNamedCityChange,
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED,
      callback: showUnnamedCityChange,
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.LOG_PHONE_ZONE,
      callback: () => {
        const { intl, calendar } = phoneZoneReadings();
        log.i("DevMenu", `phone zone: intl=${intl} calendar=${calendar}`);
      },
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.RUN_CITY_CHECK,
      callback: () => void runCityCheckNow(),
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.SHOW_CITY_CHECK_MEMORY,
      callback: showCityCheckMemory,
      shouldCollapse: true,
    },
    {
      name: DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY,
      callback: clearCityCheckMemory,
      shouldCollapse: true,
    },
  ]).catch((error: unknown) => {
    log.w("DevMenu", `dev menu items not added: ${errorText(error)}`);
  });
};

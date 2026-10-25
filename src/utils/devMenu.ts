import { registerDevMenuItems } from "expo-dev-menu";

import { DEBUG_COPY } from "@/constants/DebugScreens";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
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
    {
      // The launch check needs a real move; this puts the sheet up at once.
      name: DEBUG_COPY.SHOW_CITY_CHANGE,
      callback: () => {
        const location = useLocationStore.getState();
        // As at launch: a chosen city is never offered the device's place.
        if (location.locationMode !== LocationMode.DEVICE) {
          log.i("DevMenu", "a city is chosen; no city change to offer");
          return;
        }
        location.offerCityChange({
          currentCity: location.locationDetails.address?.city ?? DEBUG_COPY.SAMPLE_SAVED_CITY,
          newCity: DEBUG_COPY.SAMPLE_NEW_CITY,
        });
      },
      shouldCollapse: true,
    },
  ]).catch((error: unknown) => {
    log.w("DevMenu", `dev menu items not added: ${errorText(error)}`);
  });
};

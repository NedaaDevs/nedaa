import { useNavigation, useRouter } from "expo-router";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import type { ManualLocation } from "@/types/location";

const PICKER = BACK_DESTINATION.SETTINGS_LOCATION_PICKER;
const LOCATION = BACK_DESTINATION.SETTINGS_LOCATION;

/** Starts the chosen place's update and returns to Location, which draws it. */
export const usePlaceHandOver = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { applyManualLocation } = useLocationUpdate();

  return (place: ManualLocation) => {
    // The run takes its lock before this returns, so Location opens on it.
    void applyManualLocation(place);

    // The list and its coordinates are separate picker screens on the stack.
    const state = navigation.getState();
    const routes = state?.routes ?? [];
    const index = state?.index ?? routes.length - 1;
    let pickers = 0;
    while (routes[index - pickers]?.name === PICKER.route) pickers += 1;

    if (routes[index - pickers]?.name === LOCATION.route) {
      router.dismiss(pickers);
      return;
    }
    // Opened over another screen: Location takes the pickers' place.
    if (pickers > 1) router.dismiss(pickers - 1);
    router.replace(LOCATION.href);
  };
};

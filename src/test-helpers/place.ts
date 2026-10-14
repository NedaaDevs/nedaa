import { useLocationStore, type LocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** Sets the two place facts: the prayer store's flag and the saved fix. */
export const placeFacts = (
  usingDefaultLocation: boolean,
  lastKnownCoords: LocationStore["lastKnownCoords"]
) => {
  usePrayerTimesStore.setState({ usingDefaultLocation });
  useLocationStore.setState({ lastKnownCoords });
};

import { Text } from "@/components/ui/text";
import { NO_PLACE } from "@/constants/CityOffer";
import { LocationMode } from "@/enums/location";
import { useMarkPlace } from "@/hooks/useMarkPlace";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { usePlace } from "@/hooks/usePlace";
import { useZoneNote } from "@/hooks/useZoneLine";
import { useCityCheckStore } from "@/stores/cityCheck";
import { selectOfferUp, useLocationStore } from "@/stores/location";
import type { PlaceMark } from "@/types/cityCheck";
import { isLiveKept } from "@/utils/cityCheck/marks";

/** The newest kept trip still within its limit; null when none is. */
export const newestKept = (kept: readonly PlaceMark[], now: number): PlaceMark | null =>
  kept
    .filter((entry) => isLiveKept(entry, now))
    .reduce<PlaceMark | null>(
      (newest, entry) => (!newest || entry.at > newest.at ? entry : newest),
      null
    );

/** During a kept trip, how far the kept place's clock is from the saved one. */
export const KeptZoneNote = () => {
  const now = useMinuteClock().getTime();
  const kept = useCityCheckStore(({ cityCheck }) => cityCheck.kept);
  const offerUp = useLocationStore(selectOfferUp);
  const isDevicePlace = useLocationStore((state) => state.locationMode === LocationMode.DEVICE);
  const savedZone = useLocationStore((state) => state.locationDetails.timezone);
  const saved = usePlace();
  const trip = isDevicePlace && !offerUp ? newestKept(kept, now) : null;
  const place = useMarkPlace(trip);
  const note = useZoneNote(place ?? NO_PLACE, {
    city: saved.city ?? null,
    zone: savedZone || null,
  });
  if (!trip || !note) return null;

  return (
    <Text size="md" typography="helper" fontWeight="500" color="$mutedSky">
      {note}
    </Text>
  );
};

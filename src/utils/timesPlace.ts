import { ALARM_HYDRATION_TIMEOUT_MS } from "@/constants/Alarm";
import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { alarmLog } from "@/utils/alarmReport";
import { placeFromFacts } from "@/utils/placeFromFacts";
import { waitForHydration } from "@/utils/storeHydration";

/** Each store holds one of the two facts, read only once it has loaded. */
const PLACE_STORES = { prayerTimes: usePrayerTimesStore, location: useLocationStore };
const stores = Object.values(PLACE_STORES);

/** Whose place the stored times are for, as both stores read now. */
export const timesPlace = (): TimesPlace => {
  if (!stores.every((store) => store.persist.hasHydrated())) return TIMES_PLACE.UNKNOWN;
  return placeFromFacts({
    usingDefaultLocation: usePrayerTimesStore.getState().usingDefaultLocation,
    hasCoords: useLocationStore.getState().lastKnownCoords !== null,
  });
};

/** Calls `onChange` on any change to either store or to its load state. */
export const subscribeTimesPlace = (onChange: () => void): (() => void) => {
  const stops = stores.flatMap((store) => [
    store.subscribe(onChange),
    store.persist.onHydrate(onChange),
    store.persist.onFinishHydration(onChange),
  ]);
  return () => stops.forEach((stop) => stop());
};

/** Stores that missed the cap; no read waits for them again until they load. */
const late = new Set<string>();

/** Waits for one store to load, unless it has already missed the cap. */
const awaitStore = (name: string, store: (typeof stores)[number]): Promise<void> => {
  if (late.has(name)) return Promise.resolve();
  return waitForHydration(store.persist, {
    timeoutMs: ALARM_HYDRATION_TIMEOUT_MS,
    onTimeout: () => {
      if (late.has(name)) return;
      late.add(name);
      alarmLog.w("Scheduler", `${name} not hydrated in ${ALARM_HYDRATION_TIMEOUT_MS}ms`);
      const stop = store.persist.onFinishHydration(() => {
        late.delete(name);
        stop();
      });
    },
  });
};

/** `timesPlace` once both stores load; UNKNOWN if one misses the cap. */
export const readTimesPlace = async (): Promise<TimesPlace> => {
  await Promise.all(Object.entries(PLACE_STORES).map(([name, store]) => awaitStore(name, store)));
  return timesPlace();
};

/** Whether an alarm may ring at the stored times: a verified place's. */
export const isVerifiedPlace = async (): Promise<boolean> =>
  (await readTimesPlace()) === TIMES_PLACE.VERIFIED;

/** Today's times are stored, for a verified place. */
export const todayStored = (): boolean =>
  usePrayerTimesStore.getState().todayTimings !== null && timesPlace() === TIMES_PLACE.VERIFIED;

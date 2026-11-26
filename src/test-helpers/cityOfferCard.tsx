import { useSyncExternalStore, type ReactElement } from "react";
import type { ParseKeys } from "i18next";
import { act } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { CityChangeOffer } from "@/components/location/CityChangeOffer";
import { NOTICE_CARD_PART } from "@/components/ui/notice-card";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import {
  RUN_END,
  STEP_OUTCOME,
  UPDATE_START,
  UPDATE_STEP,
  type UpdateStep,
} from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { DUBAI_CITY, DUBAI_ZONE, JEDDAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_COORDS, RIYADH_ZONE } from "@/test-helpers/prayerDay";
import { ThemeProvider } from "@/test-helpers/theme";
import type { LocalizedPlaceName } from "@/types/cityCheck";
import { initialLocationDetails, type PlaceRecord } from "@/types/location";
import type { StepOutcomes } from "@/utils/updateOutcome";

export const t = i18n.t.bind(i18n);

export const RIYADH_NAME: LocalizedPlaceName = { name: RIYADH_CITY.name, names: RIYADH_CITY.names };
export const DUBAI_NAME: LocalizedPlaceName = { name: DUBAI_CITY.name, names: DUBAI_CITY.names };

/** What the card reads from the device: connectivity and screen focus. */
const status = { offline: false, focused: true, listeners: new Set<() => void>() };
const subscribe = (listener: () => void) => {
  status.listeners.add(listener);
  return () => void status.listeners.delete(listener);
};
export const useOffline = () => useSyncExternalStore(subscribe, () => status.offline);
export const useFocused = () => useSyncExternalStore(subscribe, () => status.focused);

const setStatus = (next: Partial<Pick<typeof status, "offline" | "focused">>) =>
  act(async () => {
    Object.assign(status, next);
    status.listeners.forEach((listener) => listener());
  });
export const setOffline = (offline: boolean) => setStatus({ offline });
export const setFocused = (focused: boolean) => setStatus({ focused });
export const resetStatus = () => Object.assign(status, { offline: false, focused: true });

/** A device place the update writes, named in English. */
export type WrittenPlace = {
  city: string;
  country: string;
  coords: { latitude: number; longitude: number };
  zone: string;
};
export const JEDDAH_PLACE: WrittenPlace = {
  city: JEDDAH_CITY.name,
  country: "Saudi Arabia",
  coords: { latitude: JEDDAH_CITY.latitude, longitude: JEDDAH_CITY.longitude },
  zone: RIYADH_ZONE,
};
export const DUBAI_PLACE: WrittenPlace = {
  city: DUBAI_CITY.name,
  country: "United Arab Emirates",
  coords: { latitude: DUBAI_CITY.latitude, longitude: DUBAI_CITY.longitude },
  zone: DUBAI_ZONE,
};
/** A device place no geocoder named. */
export const UNNAMED_PLACE: WrittenPlace = { ...JEDDAH_PLACE, city: "", country: "" };

/** The saved place: Riyadh, chosen, its times landed. */
export const savedRiyadh = () => {
  useLocationUpdateStore.setState({ run: null });
  useLocationStore.setState({
    cityOffer: null,
    previousPlace: null,
    isGettingLocation: false,
    lastKnownCoords: RIYADH_COORDS,
    locationDetails: initialLocationDetails,
  });
  useLocationStore.getState().setManualLocation(RIYADH_CITY);
  useLocationStore.getState().settlePlace(useLocationStore.getState().placeRevision);
};

/** A saved device place with no address and no localized name. */
export const unnamedSavedPlace = () => {
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    localizedLocation: { city: "", country: "" },
    locationDetails: { ...useLocationStore.getState().locationDetails, address: null },
  });
};

const recordOfSaved = (): PlaceRecord => {
  const {
    locationDetails,
    localizedLocation,
    locationMode,
    manualLocation,
    manualLocationChosenAt,
  } = useLocationStore.getState();
  return {
    coords: locationDetails.coords,
    address: locationDetails.address,
    timezone: locationDetails.timezone,
    fixSource: null,
    fixedAt: null,
    countryCode: locationDetails.countryCode,
    localizedLocation,
    locationMode,
    manualLocation,
    manualLocationChosenAt,
  };
};

/**
 * Writes a device place as an update does; the saved one becomes previous.
 * `settled` lands its times through the store's own settle.
 */
export const writePlace = (place: WrittenPlace, { settled = false } = {}) => {
  const previousPlace = useLocationStore.getState().previousPlace ?? recordOfSaved();
  const address = { city: place.city, country: place.country };
  useLocationStore.setState((state) => ({
    previousPlace,
    placeRevision: state.placeRevision + 1,
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    localizedLocation: address,
    locationDetails: {
      ...state.locationDetails,
      coords: { ...state.locationDetails.coords, ...place.coords },
      address,
      timezone: place.zone,
    },
  }));
  if (settled) {
    useLocationStore.getState().settlePlace(useLocationStore.getState().placeRevision);
  }
};

type RenderOptions = {
  isRTL?: boolean;
  /** Further routes, such as the screen a link opens. */
  extraRoutes?: Record<string, () => ReactElement>;
};

export const renderOffer = ({ isRTL = false, extraRoutes = {} }: RenderOptions = {}) =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <CityChangeOffer />,
      ...extraRoutes,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_LOCATION.href as string,
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

/** The card's copy as a screen reader joins it. */
export const label = () =>
  String(screen.getByTestId(NOTICE_CARD_PART.TEXT).props.accessibilityLabel);

export const button = (key: ParseKeys, params?: Record<string, unknown>) =>
  screen.getByRole("button", { name: t(key, params) });

/** Every update step done. */
export const ALL_DONE: StepOutcomes = {
  [UPDATE_STEP.LOCATION]: STEP_OUTCOME.DONE,
  [UPDATE_STEP.PRAYER_TIMES]: STEP_OUTCOME.DONE,
  [UPDATE_STEP.NOTIFICATIONS]: STEP_OUTCOME.DONE,
  [UPDATE_STEP.ALARMS]: STEP_OUTCOME.DONE,
};

/** The offer on screen, whose candidate an update applies. */
const offered = () => {
  const offer = useLocationStore.getState().cityOffer;
  if (!offer) throw new Error("no offer is up");
  return offer.candidate;
};

/** An update that writes `place`, lands its times, and ends landed. */
export const landWith = (apply: jest.Mock, place: WrittenPlace, outcomes: StepOutcomes): void => {
  apply.mockImplementation(async () => {
    writePlace(place, { settled: true });
    return { end: RUN_END.LANDED, outcomes };
  });
};

/**
 * An update that stops at `step`. The place is written when the stop is
 * after the place step; `settled` says its times had landed.
 */
export const stopWith = (
  apply: jest.Mock,
  place: WrittenPlace | null,
  step: UpdateStep,
  { settled = false } = {}
): void => {
  apply.mockImplementation(async () => {
    if (place) writePlace(place, { settled });
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.CANDIDATE, candidate: offered() }, step, failed: true },
    });
    return { end: RUN_END.STOPPED, step, outcomes: ALL_DONE };
  });
};

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused, useRouter } from "expo-router";
import type { ParseKeys } from "i18next";

import { LocationFailureOffer } from "@/components/location/LocationFailureOffer";
import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import {
  AutoUpdateSection,
  DeniedBody,
  DeviceBody,
  ManualBody,
  PermissionBody,
  StandInNotice,
} from "@/components/location/LocationStateBodies";
import { locationRootState } from "@/components/location/rootState";
import { PlaceHero } from "@/components/ui/place-hero";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  CITY_PICKER_VIEW,
  FIX_AGE_UNIT,
  FIX_SOURCE,
  LOCATION_ROOT_STATE,
  UPDATE_START,
  UPDATE_STEP,
  locationPickerRoute,
  type CityPickerView,
  type FixAgeUnit,
  type LocationRootState,
  type UpdateStep,
} from "@/constants/Location";
import { PLACE_HERO_TONE, type PlaceHeroTone } from "@/constants/PlaceHero";
import { LocationMode } from "@/enums/location";
import { useHaptic } from "@/hooks/useHaptic";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { usePlace } from "@/hooks/usePlace";
import { useVerifiedPlace } from "@/hooks/useVerifiedPlace";
import { useLocationStore } from "@/stores/location";
import { isRunning } from "@/stores/locationUpdate";
import { fixAgeOf } from "@/utils/fixAge";

type Hero = { tone: PlaceHeroTone; kicker: ParseKeys; note: ParseKeys };

const DEVICE_HERO: Hero = {
  tone: PLACE_HERO_TONE.DEVICE,
  kicker: "location.hero.deviceKicker",
  note: "location.hero.deviceNote",
};

const CITY_HERO: Hero = {
  tone: PLACE_HERO_TONE.CITY,
  kicker: "location.hero.cityKicker",
  note: "location.hero.cityNote",
};

/** Asks for a place: the device can find one, or a city can be chosen. */
const ASK_HERO: Hero = {
  tone: PLACE_HERO_TONE.NONE,
  kicker: "settings.location.title",
  note: "location.hero.askNote",
};

const DENIED_HERO: Hero = {
  tone: PLACE_HERO_TONE.NONE,
  kicker: "location.hero.deniedKicker",
  note: "location.hero.deniedNote",
};

/** A failed read leaves the saved place as it was. */
const SAVED_HERO: Hero = {
  tone: PLACE_HERO_TONE.DEVICE,
  kicker: "location.hero.savedKicker",
  note: "location.hero.savedNote",
};

type HeroFacts = {
  chosenCity: boolean;
  /** No city chosen and no verified place: the times are Makkah's. */
  noPlace: boolean;
  /** The last run read the place, then failed at the times. */
  placeChanged: boolean;
  /** A run reads the device; the place it moves to is not known yet. */
  finding: boolean;
};

/** The hero says only what holds: whose place, or that none is found. */
const heroFor = (
  state: LocationRootState,
  { chosenCity, noPlace, placeChanged, finding }: HeroFacts
): Hero => {
  switch (state) {
    // The title is the run's target once its first step has set the place.
    case LOCATION_ROOT_STATE.UPDATING:
      if (finding && noPlace) return { ...ASK_HERO, note: "location.hero.findingNote" };
      return {
        ...(chosenCity ? CITY_HERO : DEVICE_HERO),
        note: finding ? "location.hero.findingNote" : "location.hero.updatingNote",
      };
    case LOCATION_ROOT_STATE.CHECKING:
    case LOCATION_ROOT_STATE.DEVICE:
      return noPlace ? ASK_HERO : DEVICE_HERO;
    case LOCATION_ROOT_STATE.MANUAL:
      return CITY_HERO;
    case LOCATION_ROOT_STATE.PERMISSION:
      return ASK_HERO;
    case LOCATION_ROOT_STATE.DENIED:
      return DENIED_HERO;
    case LOCATION_ROOT_STATE.FAILURE:
      if (noPlace) return ASK_HERO;
      if (placeChanged) return chosenCity ? CITY_HERO : DEVICE_HERO;
      return chosenCity ? { ...SAVED_HERO, tone: PLACE_HERO_TONE.CITY } : SAVED_HERO;
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
};

const LAST_FOUND: Record<FixAgeUnit, ParseKeys> = {
  [FIX_AGE_UNIT.NOW]: "location.device.lastFound.now",
  [FIX_AGE_UNIT.MINUTES]: "location.device.lastFound.minutes",
  [FIX_AGE_UNIT.HOURS]: "location.device.lastFound.hours",
  [FIX_AGE_UNIT.DAYS]: "location.device.lastFound.days",
};

/** Settings › Location: the place the times are for, and how it is set. */
export const LocationRoot = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const mediumHaptic = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const place = usePlace();
  const verified = useVerifiedPlace();
  const now = useMinuteClock();
  const chosenCity = useLocationStore(
    (state) => state.locationMode === LocationMode.MANUAL && state.manualLocation !== null
  );
  const storedFailure = useLocationStore((state) => state.locationDetails.error);
  const lastKnown = useLocationStore(
    (state) => state.locationDetails.fix?.source === FIX_SOURCE.LAST_KNOWN
  );
  const fixedAt = useLocationStore((state) => state.locationDetails.fix?.at ?? null);
  // A read started anywhere, such as at launch, holds the controls too.
  const reading = useLocationStore((state) => state.isGettingLocation);
  const { permission, ask } = useLocationPermission();
  const {
    run: liveRun,
    executeUpdate,
    switchToDevice,
    retry,
    dismissFailure,
  } = useLocationUpdate();
  const focused = useIsFocused();
  // Behind a pushed screen this one stays mounted; the front one draws the run.
  const run = focused ? liveRun : null;
  // The system said no when the device was picked over a chosen city.
  const [refused, setRefused] = useState(false);
  const running = isRunning(run);
  const updating = running || reading;
  const failedStep: UpdateStep | null = run?.failed ? run.step : null;

  const state = locationRootState({
    chosenCity,
    permission,
    failedStep,
    storedFailure,
    reading,
    running,
  });
  // Only the location step fails before the place is written.
  const placeChanged = failedStep !== null && failedStep !== UPDATE_STEP.LOCATION;
  const noPlace = !chosenCity && !verified;
  const finding =
    running && run?.step === UPDATE_STEP.LOCATION && run.start.kind !== UPDATE_START.CITY;
  const hero = heroFor(state, { chosenCity, noPlace, placeChanged, finding });
  // A run names its target once the read is done; else only a verified place.
  const named = !noPlace || (state === LOCATION_ROOT_STATE.UPDATING && !finding);
  const title = named && place.name ? place.name : t("onboarding.location.question");
  const failure = placeChanged ? null : storedFailure;
  const age = fixedAt === null ? null : fixAgeOf(fixedAt, now.getTime());

  // A failed run is closed once another way is taken.
  const openPicker = (view: CityPickerView) => {
    dismissFailure();
    setRefused(false);
    void selectionHaptic();
    router.push(locationPickerRoute(view));
  };
  const chooseCity = () => openPicker(CITY_PICKER_VIEW.LIST);

  const refresh = () => {
    void mediumHaptic();
    void executeUpdate();
  };

  // The system asks first; a city stays until the device's place replaces it.
  const chooseDevice = async () => {
    if (updating) return;
    const access = permission?.granted ? permission : await ask();
    setRefused(chosenCity && !access.granted);
    if (!access.granted) return;
    void mediumHaptic();
    await (chosenCity ? switchToDevice() : executeUpdate());
  };

  const body = () => {
    switch (state) {
      case LOCATION_ROOT_STATE.CHECKING:
        return null;
      case LOCATION_ROOT_STATE.DEVICE:
        return (
          <DeviceBody
            onChooseCity={chooseCity}
            onRefresh={refresh}
            run={run}
            busy={updating}
            onRetry={retry}
            lastFound={age ? t(LAST_FOUND[age.unit], { count: age.count }) : undefined}
            verified={verified}
            lastKnown={lastKnown}
          />
        );
      case LOCATION_ROOT_STATE.MANUAL:
        return (
          <ManualBody
            onChooseDevice={() => void chooseDevice()}
            onChooseCity={chooseCity}
            run={run}
            busy={updating}
            onRetry={retry}
            refused={refused && !permission?.granted}
          />
        );
      case LOCATION_ROOT_STATE.PERMISSION:
        return (
          <PermissionBody onChooseDevice={() => void chooseDevice()} onChooseCity={chooseCity} />
        );
      case LOCATION_ROOT_STATE.DENIED:
        return <DeniedBody onChooseCity={chooseCity} verified={verified} />;
      case LOCATION_ROOT_STATE.UPDATING:
        return <LocationUpdateProgress run={run} onRetry={() => void retry()} />;
      case LOCATION_ROOT_STATE.FAILURE:
        return (
          <>
            {noPlace ? <StandInNotice /> : null}
            <LocationFailureOffer
              failure={failure}
              onRetry={() => void retry()}
              onChooseCity={chooseCity}
              onEnterCoordinates={() => openPicker(CITY_PICKER_VIEW.COORDINATES)}
            />
          </>
        );
      default: {
        const unhandled: never = state;
        return unhandled;
      }
    }
  };

  return (
    <>
      <VStack gap="$3.5">
        <PlaceHero tone={hero.tone} kicker={t(hero.kicker)} title={title} subtitle={t(hero.note)} />
        {body()}
      </VStack>
      {state === LOCATION_ROOT_STATE.DEVICE ? <AutoUpdateSection /> : null}
    </>
  );
};

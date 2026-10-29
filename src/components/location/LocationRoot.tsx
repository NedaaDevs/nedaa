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
} from "@/components/location/LocationStateBodies";
import { StandInNotice } from "@/components/location/StandInNotice";
import { locationRootState } from "@/components/location/rootState";
import { PlaceHero } from "@/components/ui/place-hero";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  CITY_PICKER_VIEW,
  FIX_AGE_UNIT,
  FIX_SOURCE,
  LOCATION_ROOT_STATE,
  UPDATE_STEP,
  locationPickerRoute,
  type CityPickerView,
  type FixAgeUnit,
  type LocationRootState,
  type UpdateStep,
} from "@/constants/Location";
import { PLACE_HERO_TONE, type PlaceHeroTone } from "@/constants/PlaceHero";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import { useHaptic } from "@/hooks/useHaptic";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useNewestPlace, usePlace } from "@/hooks/usePlace";
import { useVerifiedPlace } from "@/hooks/useVerifiedPlace";
import { useLocationStore } from "@/stores/location";
import { FINDING_CITY, findingCity, isRunning } from "@/stores/locationUpdate";
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

/** A failed run leaves the times with the place they belong to. */
const SAVED_HERO: Hero = {
  tone: PLACE_HERO_TONE.DEVICE,
  kicker: "location.hero.savedKicker",
  note: "location.hero.savedNote",
};

type HeroFacts = {
  chosenCity: boolean;
  /** The named place is a chosen city: the previous place while it is named. */
  namedCity: boolean;
  /** No city chosen and no verified place: the times are Makkah's. */
  noPlace: boolean;
  /** A run reads the device; the place it moves to is not known yet. */
  finding: boolean;
};

/** The hero says only what holds: whose place, or that none is found. */
const heroFor = (
  state: LocationRootState,
  { chosenCity, namedCity, noPlace, finding }: HeroFacts
): Hero => {
  const placeHero = namedCity ? CITY_HERO : DEVICE_HERO;
  switch (state) {
    // The title is the run's target once its first step has set the place.
    case LOCATION_ROOT_STATE.UPDATING:
      if (finding && noPlace) return { ...ASK_HERO, note: FINDING_CITY };
      return {
        ...(chosenCity ? CITY_HERO : DEVICE_HERO),
        note: finding ? FINDING_CITY : "location.hero.updatingNote",
      };
    case LOCATION_ROOT_STATE.CHECKING:
    case LOCATION_ROOT_STATE.DEVICE:
      return noPlace ? ASK_HERO : placeHero;
    case LOCATION_ROOT_STATE.MANUAL:
      return placeHero;
    case LOCATION_ROOT_STATE.PERMISSION:
      return ASK_HERO;
    case LOCATION_ROOT_STATE.DENIED:
      return DENIED_HERO;
    case LOCATION_ROOT_STATE.FAILURE:
      if (noPlace) return ASK_HERO;
      return namedCity ? { ...SAVED_HERO, tone: PLACE_HERO_TONE.CITY } : SAVED_HERO;
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
  const newestPlace = useNewestPlace();
  const verified = useVerifiedPlace();
  const now = useMinuteClock();
  const chosenCity = useLocationStore(
    (state) => state.locationMode === LocationMode.MANUAL && state.manualLocation !== null
  );
  // The previous place is named until the new place's times land.
  const previousMode = useLocationStore((state) => state.previousPlace?.locationMode ?? null);
  const storedFailure = useLocationStore((state) => state.locationDetails.error);
  const fix = useLocationStore((state) => state.locationDetails.fix);
  const lastKnown = fix?.source === FIX_SOURCE.LAST_KNOWN;
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
  const finding = findingCity(run);
  const namedCity = previousMode === null ? chosenCity : previousMode === LocationMode.MANUAL;
  const hero = heroFor(state, { chosenCity, namedCity, noPlace, finding });
  const showsRun = state === LOCATION_ROOT_STATE.UPDATING;
  // A run names its target once the read is done; else only a verified place.
  const named = !noPlace || (showsRun && !finding);
  const titlePlace = showsRun ? newestPlace : place;
  const title = named && titlePlace.name ? titlePlace.name : t("onboarding.location.question");
  const failure = placeChanged ? null : storedFailure;
  const age = fix && fixAgeOf(fix.at, now.getTime());

  // A failed run is closed once another way is taken.
  const openPicker = (view: CityPickerView) => {
    dismissFailure();
    setRefused(false);
    router.push(locationPickerRoute(view));
  };
  // A row ticks as it opens the picker.
  const tapPicker = (view: CityPickerView) => {
    void selectionHaptic();
    openPicker(view);
  };
  const chooseCity = () => tapPicker(CITY_PICKER_VIEW.LIST);

  const refresh = () => {
    void mediumHaptic();
    void executeUpdate();
  };

  // The system asks first; a city stays until the device's place replaces it.
  const deviceAllowed = async () => {
    if (updating) return false;
    const access = permission?.granted ? permission : await ask();
    setRefused(chosenCity && !access.granted);
    return access.granted;
  };
  const readDevice = () => (chosenCity ? switchToDevice() : executeUpdate());

  // A row ticks once access is given.
  const chooseDevice = async () => {
    if (!(await deviceAllowed())) return;
    void mediumHaptic();
    await readDevice();
  };

  // The mode choice ticks as it is tapped; the switch it starts adds none.
  const switchMode = async (mode: LocationModeValue) => {
    if (mode === LocationMode.MANUAL) openPicker(CITY_PICKER_VIEW.LIST);
    else if (await deviceAllowed()) await readDevice();
  };

  const body = () => {
    switch (state) {
      case LOCATION_ROOT_STATE.CHECKING:
        return null;
      case LOCATION_ROOT_STATE.DEVICE:
        return (
          <DeviceBody
            onSwitchMode={(mode) => void switchMode(mode)}
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
            onSwitchMode={(mode) => void switchMode(mode)}
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
              onEnterCoordinates={() => tapPicker(CITY_PICKER_VIEW.COORDINATES)}
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

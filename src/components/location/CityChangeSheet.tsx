import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";

import { LocationFailureOffer } from "@/components/location/LocationFailureOffer";
import { failedAtPlaceOrTimes } from "@/components/location/rootState";
import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { useViewFocus } from "@/hooks/useViewFocus";
import { focusOn } from "@/utils/accessibilityFocus";
import {
  Actionsheet,
  ActionsheetContent,
  ActionsheetTitle,
  useActionsheetTitle,
} from "@/components/ui/actionsheet";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { IconTile } from "@/components/ui/icon-tile";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  CITY_CHANGE_VIEW,
  CITY_PICKER_VIEW,
  UPDATE_STEP,
  locationPickerRoute,
  type CityChangeView,
  type CityPickerView,
} from "@/constants/Location";
import { useHaptic } from "@/hooks/useHaptic";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { usePlace } from "@/hooks/usePlace";
import { useLocationStore } from "@/stores/location";
import { isRunning, useLocationUpdateStore, type UpdateRun } from "@/stores/locationUpdate";
import type { CityCandidate, CityOffer } from "@/types/cityCheck";
import { resolveLocalizedName } from "@/utils/cities";

type CityBoxProps = { label: string; city: string; isNew: boolean };

/** One side of the change: what the city is to the user, and its name. */
const CityBox = ({ label, city, isNew }: CityBoxProps) => {
  const { t } = useTranslation();
  return (
    <VStack
      flex={1}
      gap="$0.5"
      padding="$3"
      borderRadius="$control"
      backgroundColor={isNew ? "$accentTint" : "$surface2Soft"}
      accessible
      accessibilityLabel={t("a11y.join", { first: label, second: city })}>
      <Text size="xs" color="$muted">
        {label}
      </Text>
      <Text size="md" fontWeight="600" color={isNew ? "$accentText" : "$fg"}>
        {city}
      </Text>
    </VStack>
  );
};

type RunViewProps = {
  run: UpdateRun;
  onRetry: () => void;
  onChooseCity: () => void;
  onEnterCoordinates: () => void;
  onClose: () => void;
};

/** The sheet's own run: its steps, the failure card, or a later step's stop. */
const RunView = ({ run, onRetry, onChooseCity, onEnterCoordinates, onClose }: RunViewProps) => {
  const { t } = useTranslation();
  const storedFailure = useLocationStore((state) => state.locationDetails.error);
  if (run.failed && failedAtPlaceOrTimes(run.step)) {
    return (
      <LocationFailureOffer
        // A failed read names its kind; a failure after it is the times'.
        failure={run.step === UPDATE_STEP.LOCATION ? storedFailure : null}
        onRetry={onRetry}
        onChooseCity={onChooseCity}
        onEnterCoordinates={onEnterCoordinates}
        inSheet
      />
    );
  }
  const close = t("common.close");
  return (
    <VStack gap="$3">
      <LocationUpdateProgress run={run} onRetry={onRetry} inSheet />
      {run.failed ? (
        <Button action="secondary" variant="outline" onPress={onClose} accessibilityLabel={close}>
          <Button.Text>{close}</Button.Text>
        </Button>
      ) : null}
    </VStack>
  );
};

type OfferProps = {
  /** Another run holds the lock; Update waits for it. */
  busy: boolean;
  onUpdate: () => void;
  onKeep: () => void;
};

/** Update to the city the device is in, or keep the saved one. */
const OfferButtons = ({ busy, onUpdate, onKeep }: OfferProps) => {
  const { t } = useTranslation();
  const update = t("location.cityChange.update");
  const keep = t("location.cityChange.keep");
  return (
    <VStack gap="$2">
      <Button
        onPress={onUpdate}
        disabled={busy}
        accessibilityLabel={update}
        accessibilityHint={t("a11y.location.cityChange.updateHint")}>
        <Button.Text>{update}</Button.Text>
      </Button>
      <Button action="secondary" variant="outline" onPress={onKeep} accessibilityLabel={keep}>
        <Button.Text>{keep}</Button.Text>
      </Button>
    </VStack>
  );
};

type BodyProps = Omit<RunViewProps, "run"> &
  OfferProps & {
    /** The saved city's name; an unnamed saved place shows no box. */
    savedCity: string | undefined;
    newCity: string;
    /** The sheet's run, or null while it offers the update. */
    run: UpdateRun | null;
  };

/** The candidate's name in the app's language, or its distance when unnamed. */
const useCandidateName = (candidate: CityCandidate): string => {
  const { t, i18n } = useTranslation();
  const { name, distanceKm } = candidate;
  return name
    ? resolveLocalizedName(name.name, name.names ?? undefined, i18n.language)
    : t("location.cityChange.unnamedPlace", { distance: Math.round(distanceKm) });
};

const viewOf = (run: UpdateRun | null): CityChangeView => {
  if (!run) return CITY_CHANGE_VIEW.OFFER;
  return run.failed ? CITY_CHANGE_VIEW.STOPPED : CITY_CHANGE_VIEW.RUNNING;
};

/** The two cities, what an update changes, then the offer or the run. */
const CityChangeBody = ({
  savedCity,
  newCity,
  run,
  busy,
  onUpdate,
  onKeep,
  ...runView
}: BodyProps) => {
  const { t } = useTranslation();
  const title = useActionsheetTitle();
  // Content swaps under the reader, never the title; focus goes back to it.
  useViewFocus(viewOf(run), () => focusOn(title.current));
  return (
    <VStack gap="$4">
      <VStack alignItems="center" gap="$2">
        <IconTile icon={MapPin} />
        <ActionsheetTitle>
          <VStack alignItems="center" gap="$1">
            <Text size="sm" color="$muted" textAlign="center">
              {t("location.cityChange.greeting")}
            </Text>
            <Text size="lg" bold typography="title" color="$fg" textAlign="center">
              {t("location.cityChange.title")}
            </Text>
          </VStack>
        </ActionsheetTitle>
      </VStack>
      {/* In reading order: the saved city at the start. */}
      <HStack gap="$2">
        {savedCity ? (
          <CityBox label={t("location.cityChange.saved")} city={savedCity} isNew={false} />
        ) : null}
        <CityBox label={t("location.cityChange.now")} city={newCity} isNew />
      </HStack>
      <Text size="sm" color="$muted" textAlign="center">
        {t("location.cityChanged.description")}
      </Text>
      {run ? (
        <RunView run={run} {...runView} />
      ) : (
        <OfferButtons busy={busy} onUpdate={onUpdate} onKeep={onKeep} />
      )}
    </VStack>
  );
};

type OfferBodyProps = Omit<BodyProps, "newCity"> & { candidate: CityCandidate };

/** Names the new place, then draws the body. */
const OfferBody = ({ candidate, ...body }: OfferBodyProps) => {
  const newCity = useCandidateName(candidate);
  return <CityChangeBody newCity={newCity} {...body} />;
};

/** The offer as drawn, with the saved city's name when it came. */
type DrawnOffer = { offer: CityOffer; savedCity: string | undefined };

type Props = {
  /** The onboarding gate covers the app; the offer waits until it leaves. */
  onboarding: boolean;
};

/** Offers the times for the city the device is in, or keeps the saved one. */
export const CityChangeSheet = ({ onboarding }: Props) => {
  const router = useRouter();
  const mediumHaptic = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const cityOffer = useLocationStore((state) => state.cityOffer);
  const keepCityOffer = useLocationStore((state) => state.keepCityOffer);
  const dismissCityOffer = useLocationStore((state) => state.dismissCityOffer);
  const savedCity = usePlace().city;
  // The last offer stays drawn while the sheet leaves. The saved city keeps its
  // name from the offer's arrival: an update moves the place under the sheet.
  const [drawn, setDrawn] = useState<DrawnOffer | null>(
    cityOffer && { offer: cityOffer, savedCity }
  );
  if (cityOffer && cityOffer !== drawn?.offer) setDrawn({ offer: cityOffer, savedCity });
  const offer = cityOffer ?? drawn?.offer;
  const { run, applyCandidate, retry, dismissFailure } = useLocationUpdate();
  // Set only when this sheet's update takes the lock, so only its run is drawn.
  const [started, setStarted] = useState(false);
  // The sheet's run; it outlives the store's while the sheet leaves.
  const [shown, setShown] = useState<UpdateRun | null>(null);
  if (started && run && run !== shown) setShown(run);

  const update = async (candidate: CityCandidate) => {
    if (isRunning(useLocationUpdateStore.getState().run)) return;
    void mediumHaptic();
    setStarted(true);
    if (await applyCandidate(candidate)) dismissCityOffer();
  };
  const retryUpdate = async () => {
    if (await retry()) dismissCityOffer();
  };
  // Another way out of a failed read leaves the sheet for the city picker.
  const openPicker = (view: CityPickerView) => {
    dismissFailure();
    dismissCityOffer();
    router.push(locationPickerRoute(view));
  };
  const onClose = () => {
    setStarted(false);
    setShown(null);
    dismissCityOffer();
  };

  return (
    <Actionsheet isOpen={cityOffer !== null && !onboarding} onClose={onClose} fitContent>
      <ActionsheetContent>
        {offer ? (
          <OfferBody
            candidate={offer.candidate}
            savedCity={drawn?.savedCity}
            run={shown}
            busy={isRunning(run)}
            onUpdate={() => void update(offer.candidate)}
            onKeep={keepCityOffer}
            onRetry={() => void retryUpdate()}
            onChooseCity={() => openPicker(CITY_PICKER_VIEW.LIST)}
            onEnterCoordinates={() => openPicker(CITY_PICKER_VIEW.COORDINATES)}
            onClose={dismissCityOffer}
          />
        ) : null}
      </ActionsheetContent>
    </Actionsheet>
  );
};

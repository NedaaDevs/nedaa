import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";

import { LocationFailureOffer } from "@/components/location/LocationFailureOffer";
import { failedAtPlaceOrTimes } from "@/components/location/rootState";
import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { useViewFocus } from "@/hooks/useViewFocus";
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
import { useAppStore } from "@/stores/app";
import { useLocationStore, type LocationStore } from "@/stores/location";
import { isRunning, useLocationUpdateStore, type UpdateRun } from "@/stores/locationUpdate";

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
        accessibilityHint={t("a11y.location.refreshHint")}>
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
    offer: NonNullable<LocationStore["pendingCityChange"]>;
    /** The sheet's run, or null while it offers the update. */
    run: UpdateRun | null;
  };

const viewOf = (run: UpdateRun | null): CityChangeView => {
  if (!run) return CITY_CHANGE_VIEW.OFFER;
  return run.failed ? CITY_CHANGE_VIEW.STOPPED : CITY_CHANGE_VIEW.RUNNING;
};

/** The two cities, what an update changes, then the offer or the run. */
const CityChangeBody = ({ offer, run, busy, onUpdate, onKeep, ...runView }: BodyProps) => {
  const { t } = useTranslation();
  // Content swaps under the reader; focus goes back to the title.
  useViewFocus(viewOf(run), useActionsheetTitle());
  return (
    <VStack gap="$4">
      <VStack alignItems="center" gap="$2">
        <IconTile icon={MapPin} />
        <ActionsheetTitle>
          <Text size="lg" bold typography="title" color="$fg" textAlign="center">
            {t("location.cityChange.title")}
          </Text>
        </ActionsheetTitle>
      </VStack>
      {/* In reading order: the saved city at the start. */}
      <HStack gap="$2">
        <CityBox label={t("location.cityChange.saved")} city={offer.currentCity} isNew={false} />
        <CityBox label={t("location.cityChange.now")} city={offer.newCity} isNew />
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

/** Offers the times for the city the device is in, or keeps the saved one. */
export const CityChangeSheet = () => {
  const router = useRouter();
  const mediumHaptic = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const offer = useLocationStore((state) => state.pendingCityChange);
  const up = useLocationStore((state) => state.showCityChangeModal);
  const closeCityChange = useLocationStore((state) => state.closeCityChange);
  const clearCityChange = useLocationStore((state) => state.clearCityChange);
  const onboarding = useAppStore((state) => state.isFirstRun);
  const { run, executeUpdate, retry, dismissFailure } = useLocationUpdate();
  // Set only when this sheet's update takes the lock, so only its run is drawn.
  const [started, setStarted] = useState(false);
  // The sheet's run; it outlives the store's while the sheet leaves.
  const [shown, setShown] = useState<UpdateRun | null>(null);
  if (started && run && run !== shown) setShown(run);

  const update = async () => {
    if (isRunning(useLocationUpdateStore.getState().run)) return;
    void mediumHaptic();
    setStarted(true);
    if (await executeUpdate()) closeCityChange();
  };
  const retryUpdate = async () => {
    if (await retry()) closeCityChange();
  };
  // Another way out of a failed read leaves the sheet for the city picker.
  const openPicker = (view: CityPickerView) => {
    dismissFailure();
    closeCityChange();
    router.push(locationPickerRoute(view));
  };
  const onClose = () => {
    setStarted(false);
    setShown(null);
    clearCityChange();
  };

  return (
    <Actionsheet isOpen={up && offer !== null && !onboarding} onClose={onClose} fitContent>
      <ActionsheetContent>
        {offer ? (
          <CityChangeBody
            offer={offer}
            run={shown}
            busy={isRunning(run)}
            onUpdate={() => void update()}
            onKeep={closeCityChange}
            onRetry={() => void retryUpdate()}
            onChooseCity={() => openPicker(CITY_PICKER_VIEW.LIST)}
            onEnterCoordinates={() => openPicker(CITY_PICKER_VIEW.COORDINATES)}
            onClose={closeCityChange}
          />
        ) : null}
      </ActionsheetContent>
    </Actionsheet>
  );
};

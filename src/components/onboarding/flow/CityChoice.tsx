import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CityPicker from "@/components/location/CityPicker";
import CoordinateEntry from "@/components/location/CoordinateEntry";
import { LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useStepBack } from "@/components/onboarding/flow/useStepBack";
import { useViewFocus } from "@/hooks/useViewFocus";
import { Button } from "@/components/ui/button";
import { ScreenContent } from "@/components/ui/screen-content";
import { SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { CITY_PICKER_VIEW, type CityPickerView } from "@/constants/Location";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { LocationMode } from "@/enums/location";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import type { ManualLocation } from "@/types/location";

/** Drops a manual city picked at or after `since`; one stored before stays. */
export const dropCityTriedSince = (since: number) => {
  const { locationMode, manualLocationChosenAt, clearManualLocation } = useLocationStore.getState();
  const tried =
    locationMode === LocationMode.MANUAL &&
    manualLocationChosenAt !== null &&
    manualLocationChosenAt >= since;
  if (tried) clearManualLocation();
};

/** The way to a city by hand, when location is refused or the times fail. */
export const ChooseCityButton = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  // Only device mode shares a location; a chosen city's label is its words.
  const manual = useLocationStore((state) => state.locationMode === LocationMode.MANUAL);
  const words = t("onboarding.location.chooseCity");
  return (
    <Button
      testID={ONBOARDING_PART.CHOOSE_CITY}
      action="secondary"
      variant="outline"
      size="lg"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={manual ? words : t("a11y.onboarding.chooseCityManually")}>
      <Button.Text>{words}</Button.Text>
    </Button>
  );
};

type PickerProps = Pick<StepProps, "headingRef" | "progress" | "setBack" | "setPrimaryHidden"> & {
  /** The host's own success: its session write, then on. */
  onDone: () => void;
  /** Leaves the list for the host's view before it. */
  onClose: () => void;
  /** The view it opens on; coordinates opened first go back to the host. */
  initialView?: CityPickerView;
};

/** A step's city list or coordinate entry, drawn in place of its body. */
export const StepCityPicker = ({
  headingRef,
  progress,
  setBack,
  setPrimaryHidden,
  onDone,
  onClose,
  initialView = CITY_PICKER_VIEW.LIST,
}: PickerProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState<CityPickerView>(initialView);
  const coordinates = view === CITY_PICKER_VIEW.COORDINATES;
  const listBehind = coordinates && initialView === CITY_PICKER_VIEW.LIST;

  // Shown until it unmounts or its back leaves for the host's view.
  const open = useRef(true);
  const close = () => {
    open.current = false;
    onClose();
  };
  // A pick landing after the list closed counts only while its city is stored.
  const done = () => {
    if (open.current || useLocationStore.getState().locationMode === LocationMode.MANUAL) {
      onDone();
    }
  };

  // With no Location screen behind it, a pick waits here for its update.
  const { run, applyManualLocation, retry } = useLocationUpdate();
  const pick = async (place: ManualLocation) => {
    if (await applyManualLocation(place)) done();
  };
  // A failed pick is retried in place; one that lands moves the step on.
  const retryPick = async () => {
    if (await retry()) done();
  };

  // Back walks out one view at a time: coordinates, the list, then the host.
  useStepBack(setBack, listBehind ? () => setView(CITY_PICKER_VIEW.LIST) : close);
  useViewFocus(view, headingRef);

  // A pick is the way on and Skip the way out: the frame's primary steps aside.
  const hidePrimary = useEffectEvent((hidden: boolean) => setPrimaryHidden(hidden));
  useLayoutEffect(() => {
    open.current = true;
    hidePrimary(true);
    return () => {
      open.current = false;
      hidePrimary(false);
    };
  }, []);

  return (
    <ScreenContent flex={1} paddingTop="$4" gap="$3">
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t(coordinates ? "location.coordinates.title" : "location.picker.title")}
      />
      <LocationUpdateProgress run={run} onRetry={() => void retryPick()} />
      {/* Either view grows with the text size, so it scrolls. */}
      <SkyScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <VStack paddingBottom="$4">
          {coordinates ? (
            <CoordinateEntry onSave={(place) => void pick(place)} />
          ) : (
            <CityPicker
              onPick={(place) => void pick(place)}
              onEnterCoordinates={() => setView(CITY_PICKER_VIEW.COORDINATES)}
            />
          )}
        </VStack>
      </SkyScrollView>
    </ScreenContent>
  );
};

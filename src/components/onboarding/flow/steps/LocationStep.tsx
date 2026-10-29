import { useState } from "react";
import { useTranslation } from "react-i18next";

import { StepCityPicker } from "@/components/onboarding/flow/CityChoice";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { useViewFocus } from "@/hooks/useViewFocus";
import { ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { SkyOccluder } from "@/components/ui/sky-background";
import {
  LOCATION_CHOICE,
  LOCATION_STEP_VIEW,
  ONBOARDING_PART,
  type LocationChoice,
  type LocationStepView,
} from "@/constants/Onboarding";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

/** Automatic location or a city; the city picker opens in place. */
export const LocationStep = ({
  onNext,
  setSession,
  setPrimary,
  setPrimaryHidden,
  setBack,
  setBusy,
  dropTriedCity,
  headingRef,
  onHeadingLayout,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const [choice, setChoice] = useState<LocationChoice>(LOCATION_CHOICE.AUTOMATIC);
  const [view, setView] = useState<LocationStepView>(LOCATION_STEP_VIEW.CHOICE);
  useViewFocus(view, headingRef);

  const choose = (next: LocationChoice) => {
    hapticSelection();
    setChoice(next);
  };
  const cityDone = () => {
    setSession({ locationChoice: LOCATION_CHOICE.CITY });
    onNext();
  };
  const proceed = () => {
    if (choice === LOCATION_CHOICE.CITY) {
      setView(LOCATION_STEP_VIEW.PICKER);
      return;
    }
    // A city tried and left gives way to the device's own place.
    dropTriedCity();
    setSession({ locationChoice: LOCATION_CHOICE.AUTOMATIC });
    onNext();
  };

  useStepPrimary(
    setPrimary,
    view === LOCATION_STEP_VIEW.CHOICE
      ? { label: t("onboarding.continue"), onPress: proceed }
      : null
  );

  if (view === LOCATION_STEP_VIEW.PICKER) {
    return (
      <StepCityPicker
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        setBack={setBack}
        setBusy={setBusy}
        setPrimaryHidden={setPrimaryHidden}
        onDone={cityDone}
        onClose={() => setView(LOCATION_STEP_VIEW.CHOICE)}
      />
    );
  }

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        title={t("onboarding.location.question")}
        body={t("onboarding.location.body")}
      />
      <SkyOccluder>
        <ChoiceGroup label={t("onboarding.location.question")}>
          <ChoiceRow
            title={t("onboarding.location.automatic")}
            subtitle={t("onboarding.location.automaticNote")}
            selected={choice === LOCATION_CHOICE.AUTOMATIC}
            onPress={() => choose(LOCATION_CHOICE.AUTOMATIC)}
          />
          <ChoiceRow
            testID={ONBOARDING_PART.LOCATION_CITY}
            title={t("onboarding.location.city")}
            subtitle={t("onboarding.location.cityNote")}
            selected={choice === LOCATION_CHOICE.CITY}
            onPress={() => choose(LOCATION_CHOICE.CITY)}
          />
        </ChoiceGroup>
      </SkyOccluder>
    </StepBody>
  );
};

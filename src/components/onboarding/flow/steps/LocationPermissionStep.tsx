import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ChooseCityButton, StepCityPicker } from "@/components/onboarding/flow/CityChoice";
import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useBusyRequest } from "@/components/onboarding/flow/useBusyRequest";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { useViewFocus } from "@/components/onboarding/flow/useViewFocus";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { LOCATION_CHOICE } from "@/constants/Onboarding";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { requestLocationPermission } from "@/utils/location";

/** Asks for location in place; a denial offers a city instead. */
export const LocationPermissionStep = ({
  onNext,
  setBusy,
  setSession,
  setPrimary,
  setPrimaryHidden,
  setBack,
  headingRef,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const [picking, setPicking] = useState(false);
  const { request } = useBusyRequest(setBusy);
  useViewFocus(picking, headingRef);
  const deniedBody = t("onboarding.location.deniedBody");
  useIosAnnouncement(denied ? deniedBody : null);

  const allow = () =>
    request(() =>
      requestLocationPermission().then(({ granted }) => {
        if (!granted) {
          setDenied(true);
          return;
        }
        setSession({ locationGranted: true });
        onNext();
      })
    );

  useStepPrimary(
    setPrimary,
    denied ? null : { label: t("onboarding.locationPermission.allow"), onPress: allow }
  );

  if (picking) {
    return (
      <StepCityPicker
        headingRef={headingRef}
        progress={progress}
        setBack={setBack}
        setPrimaryHidden={setPrimaryHidden}
        onDone={() => {
          // Withdrawing the automatic choice drops the prime from the column.
          setSession({ locationChoice: LOCATION_CHOICE.CITY });
          onNext();
        }}
        onClose={() => setPicking(false)}
      />
    );
  }

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t("onboarding.locationPermission.title")}
        body={t("onboarding.locationPermission.body")}
      />
      <SkyOccluder>
        <OnboardingCard gap="$3">
          <Text size="sm" color="$fg" accessibilityLiveRegion={denied ? "polite" : undefined}>
            {denied ? deniedBody : t("onboarding.locationPermission.card")}
          </Text>
          {denied ? <ChooseCityButton onPress={() => setPicking(true)} /> : null}
        </OnboardingCard>
      </SkyOccluder>
    </StepBody>
  );
};

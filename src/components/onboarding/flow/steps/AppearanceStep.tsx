import { useTranslation } from "react-i18next";

import { OnboardingPreview } from "@/components/onboarding/flow/OnboardingPreview";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { AppearanceChoices } from "@/components/settings/AppearanceChoices";
import { SkyOccluder } from "@/components/ui/sky-background";

/** The four modes of Settings over the flow's own sky; no colour family. */
export const AppearanceStep = ({ headingRef, progress }: StepProps) => {
  const { t } = useTranslation();

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t("onboarding.appearance.title")}
        body={t("onboarding.appearance.body")}
      />
      <OnboardingPreview />
      <SkyOccluder>
        <AppearanceChoices />
      </SkyOccluder>
    </StepBody>
  );
};

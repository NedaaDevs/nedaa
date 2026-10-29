import { useTranslation } from "react-i18next";

import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { LanguageChoices } from "@/components/settings/LanguageChoices";
import { SkyOccluder } from "@/components/ui/sky-background";

/** The language list of Settings, chosen through the same path. */
export const LanguageStep = ({ headingRef, onHeadingLayout, progress }: StepProps) => {
  const { t } = useTranslation();

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        title={t("onboarding.language.title")}
      />
      <SkyOccluder>
        <LanguageChoices />
      </SkyOccluder>
    </StepBody>
  );
};

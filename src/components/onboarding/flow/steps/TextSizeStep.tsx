import { useEffect, useEffectEvent } from "react";
import { PixelRatio } from "react-native";
import { useTranslation } from "react-i18next";

import { OnboardingPreview } from "@/components/onboarding/flow/OnboardingPreview";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SkyOccluder } from "@/components/ui/sky-background";
import { nearestTextSize } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";
import { usePreferencesStore } from "@/stores/preferences";
import { isLargeOsTextActive } from "@/utils/textSizeOffer";

const TEXT_SIZES = Object.values(TextSize);

/** The app's text size; the whole frame and the preview follow the choice. */
export const TextSizeStep = ({
  onNext,
  setPrimary,
  headingRef,
  onHeadingLayout,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const textSize = usePreferencesStore((state) => state.textSize);
  const setTextSize = usePreferencesStore((state) => state.setTextSize);
  const markHandled = usePreferencesStore((state) => state.markTextSizeOfferHandled);

  // The phone's large text preselects the nearest size, once.
  const seed = useEffectEvent(() => {
    if (isLargeOsTextActive() && !usePreferencesStore.getState().textSizeOfferHandled) {
      setTextSize(nearestTextSize(PixelRatio.getFontScale()));
    }
  });
  useEffect(() => {
    seed();
  }, []);

  useStepPrimary(setPrimary, {
    label: t("onboarding.continue"),
    onPress: () => {
      markHandled();
      onNext();
    },
  });

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        title={t("onboarding.textSize.chooseTitle")}
        body={t("onboarding.textSize.chooseBody")}
      />
      <SkyOccluder>
        <SegmentedChoice
          options={TEXT_SIZES}
          value={textSize}
          onChange={setTextSize}
          accessibilityLabel={t("onboarding.textSize.chooseTitle")}
          label={(value) => t(`settings.textSize.options.${value}`)}
        />
      </SkyOccluder>
      <OnboardingPreview />
    </StepBody>
  );
};

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PlayDayButton } from "@/components/onboarding/flow/PlayDayButton";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { AppearanceChoices } from "@/components/settings/AppearanceChoices";
import { TodayStyleChoices } from "@/components/settings/TodayStyleChoices";
import { TodayStylePreview } from "@/components/today/TodayStylePreview";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ONBOARDING_PART, ONBOARDING_PATH } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";

/** Today's preview, a day of Adaptive, Today's style, then the modes. */
export const AppearanceStep = ({ headingRef, onHeadingLayout, progress, path }: StepProps) => {
  const { t } = useTranslation();
  // The mode stored when the step opens, marked for an upgrader.
  const [storedMode] = useState(() => useAppStore.getState().mode);
  const currentMark = path === ONBOARDING_PATH.UPGRADE ? storedMode : undefined;

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        onHeadingLayout={onHeadingLayout}
        progress={progress}
        title={t("onboarding.appearance.title")}
        body={t("onboarding.appearance.body")}
      />
      <VStack testID={ONBOARDING_PART.APPEARANCE_PREVIEW} gap="$3.5">
        <TodayStylePreview sampleUnlessOwn />
        <PlayDayButton />
      </VStack>
      <SkyOccluder>
        <VStack gap="$2">
          <Text size="sm" fontWeight="600" color="$fg">
            {t("settings.preferences.todayStyle.title")}
          </Text>
          <TodayStyleChoices />
        </VStack>
      </SkyOccluder>
      <SkyOccluder>
        <AppearanceChoices currentMark={currentMark} />
      </SkyOccluder>
    </StepBody>
  );
};

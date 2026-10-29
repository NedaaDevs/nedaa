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

/** Today's preview, a day of Adaptive, Today's style, then the modes. */
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
      <VStack gap="$3.5">
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
        <AppearanceChoices />
      </SkyOccluder>
    </StepBody>
  );
};

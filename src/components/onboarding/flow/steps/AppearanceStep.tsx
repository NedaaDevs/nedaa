import { useTranslation } from "react-i18next";

import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { AppearanceChoices } from "@/components/settings/AppearanceChoices";
import { TodayStylePreview } from "@/components/today/TodayStylePreview";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TODAY_STYLE } from "@/constants/Today";
import { usePreferencesStore } from "@/stores/preferences";

const TODAY_STYLES = Object.values(TODAY_STYLE);

/** Today's style over a preview of it, then the four modes of Settings. */
export const AppearanceStep = ({ headingRef, progress }: StepProps) => {
  const { t } = useTranslation();
  const todayStyle = usePreferencesStore((state) => state.todayStyle);
  const setTodayStyle = usePreferencesStore((state) => state.setTodayStyle);

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t("onboarding.appearance.title")}
        body={t("onboarding.appearance.body")}
      />
      <TodayStylePreview sampleUnlessOwn />
      <SkyOccluder>
        <VStack gap="$2">
          <Text size="sm" fontWeight="600" color="$fg">
            {t("settings.preferences.todayStyle.title")}
          </Text>
          <SegmentedChoice
            options={TODAY_STYLES}
            value={todayStyle}
            onChange={setTodayStyle}
            accessibilityLabel={t("settings.preferences.todayStyle.title")}
            label={(style) => t(`settings.preferences.todayStyle.options.${style}`)}
          />
        </VStack>
      </SkyOccluder>
      <SkyOccluder>
        <AppearanceChoices />
      </SkyOccluder>
    </StepBody>
  );
};

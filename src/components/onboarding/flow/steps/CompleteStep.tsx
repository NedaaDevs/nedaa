import { useEffect, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScreenContent } from "@/components/ui/screen-content";
import { SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { ONBOARDING_PART, ONBOARDING_PATH } from "@/constants/Onboarding";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { usePlace } from "@/hooks/usePlace";
import { useTodayStored } from "@/hooks/useTodayStored";

const GROW = { flexGrow: 1 };

/** The last page: what was set up, and the way into the app. */
export const CompleteStep = ({
  onNext,
  headingRef,
  onHeadingLayout,
  progress,
  path,
}: StepProps) => {
  const { t } = useTranslation();
  const city = usePlace().city;
  const todayStored = useTodayStored();
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);

  const arrive = useEffectEvent(() => {
    void success();
  });
  useEffect(() => {
    arrive();
  }, []);

  const open = t("onboarding.complete.open");
  // An upgrader's city and alerts are theirs from 2.x; the body says they stay.
  const body =
    path === ONBOARDING_PATH.UPGRADE
      ? t("onboarding.upgrade.completeBody")
      : city && todayStored
        ? t("onboarding.complete.body")
        : t("onboarding.complete.bodyNoCity");

  return (
    <SkyScrollView contentContainerStyle={GROW} showsVerticalScrollIndicator={false}>
      <ScreenContent flex={1} paddingVertical="$6" gap="$6">
        <VStack flex={1} alignItems="center" justifyContent="center" gap="$3">
          <SkyOccluder>
            <Box
              width="$16"
              height="$16"
              borderRadius="$pill"
              borderWidth={1}
              borderColor="$accent"
              backgroundColor="$accentSoft"
              alignItems="center"
              justifyContent="center">
              <Icon as={Check} size="2xl" color="$accent" />
            </Box>
          </SkyOccluder>
          <StepHeading
            headingRef={headingRef}
            onHeadingLayout={onHeadingLayout}
            progress={progress}
            centered
            title={t("onboarding.complete.title")}
            body={body}
          />
        </VStack>

        <SkyOccluder>
          <Button
            testID={ONBOARDING_PART.COMPLETE_OPEN}
            action="primary"
            variant="solid"
            size="lg"
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={open}>
            <Button.Text>{open}</Button.Text>
          </Button>
        </SkyOccluder>
      </ScreenContent>
    </SkyScrollView>
  );
};

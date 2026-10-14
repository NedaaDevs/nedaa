import { useEffect, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { useHaptic } from "@/hooks/useHaptic";
import { usePlace } from "@/hooks/usePlace";
import { useTodayStored } from "@/hooks/useTodayStored";

const GROW = { flexGrow: 1 };

/** The last page: what was set up, and the way into the app. */
export const CompleteStep = ({ onNext, headingRef, progress }: StepProps) => {
  const { t } = useTranslation();
  const city = usePlace().city;
  const todayStored = useTodayStored();
  const success = useHaptic("success");

  const arrive = useEffectEvent(() => {
    void success();
  });
  useEffect(() => {
    arrive();
  }, []);

  const open = t("onboarding.complete.open");

  return (
    <SkyScrollView contentContainerStyle={GROW} showsVerticalScrollIndicator={false}>
      <VStack flex={1} paddingHorizontal="$4" paddingVertical="$6" gap="$6">
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
            progress={progress}
            centered
            title={t("onboarding.complete.title")}
            body={
              city && todayStored
                ? t("onboarding.complete.body")
                : t("onboarding.complete.bodyNoCity")
            }
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
      </VStack>
    </SkyScrollView>
  );
};

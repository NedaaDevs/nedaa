import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { MotiView } from "moti";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonText } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react-native";

import StepProgress from "@/components/umrah/StepProgress";
import StepCard from "@/components/umrah/StepCard";
import StageChecklist from "@/components/umrah/StageChecklist";

import { UMRAH_STAGES } from "@/constants/UmrahGuide";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";
import { useRTL } from "@/contexts/RTLContext";

export default function StepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const { stageIndex: stageIndexParam } = useLocalSearchParams<{ stageIndex: string }>();
  const selectionHaptic = useHaptic("selection");
  const successHaptic = useHaptic("success");

  const {
    activeProgress,
    advanceStep,
    goToPreviousStep,
    completeStage,
    moveToNextStage,
    toggleChecklistItem,
  } = useUmrahGuideStore();

  const stageIndex = parseInt(stageIndexParam || "0", 10);
  const stage = UMRAH_STAGES[stageIndex];

  if (!stage || !activeProgress) {
    return (
      <Background>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text color="$typography">{t("umrah.overview")}</Text>
        </Box>
      </Background>
    );
  }

  const currentStep = activeProgress.currentStepIndex;
  const totalSteps = stage.steps.length;
  const step = stage.steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isLastStage = stageIndex === UMRAH_STAGES.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = async () => {
    await selectionHaptic();
    if (isLastStep) {
      // Complete this stage
      await successHaptic();
      completeStage();

      if (isLastStage) {
        router.replace("/umrah/complete");
      } else {
        moveToNextStage();
        router.replace({
          pathname: "/umrah/step",
          params: { stageIndex: String(stageIndex + 1) },
        });
      }
    } else {
      advanceStep();
    }
  };

  const handlePrevious = async () => {
    await selectionHaptic();
    if (isFirstStep) {
      router.back();
    } else {
      goToPreviousStep();
    }
  };

  const handleOverview = () => {
    router.back();
  };

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <Background>
      {/* Stage title */}
      <Box paddingHorizontal="$4" paddingTop="$4" paddingBottom="$1">
        <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
          {t(stage.titleKey)}
        </Text>
      </Box>

      {/* Progress bar */}
      <StepProgress currentStep={currentStep} totalSteps={totalSteps} />

      {/* Step content */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>
        {step.type === "checklist" ? (
          <VStack flex={1} justifyContent="center" gap="$4">
            <VStack alignItems="center" gap="$2" paddingHorizontal="$4">
              <MotiView
                from={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}>
                <Box
                  width={56}
                  height={56}
                  borderRadius={28}
                  backgroundColor="$accentPrimary"
                  alignItems="center"
                  justifyContent="center">
                  <Icon as={Check} size="lg" color="white" />
                </Box>
              </MotiView>
              <Text size="xl" fontWeight="700" color="$typography" textAlign="center">
                {t(step.titleKey)}
              </Text>
              {step.descriptionKey && (
                <Text size="sm" color="$typographySecondary" textAlign="center">
                  {t(step.descriptionKey)}
                </Text>
              )}
            </VStack>

            {step.checklistItems && (
              <StageChecklist
                items={step.checklistItems}
                checklistState={activeProgress.checklistState}
                onToggle={toggleChecklistItem}
              />
            )}
          </VStack>
        ) : (
          <StepCard step={step} />
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        paddingHorizontal="$4"
        paddingVertical="$3"
        paddingBottom="$6"
        backgroundColor="$backgroundElevated">
        <HStack gap="$3" alignItems="center">
          <Pressable
            onPress={handlePrevious}
            padding="$3"
            borderRadius="$3"
            backgroundColor="$backgroundSecondary"
            minWidth={48}
            minHeight={48}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={isFirstStep ? t("umrah.overview") : t("a11y.back")}>
            <Icon as={PrevIcon} size="md" color="$typography" />
          </Pressable>

          <Button
            flex={1}
            size="lg"
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={
              isLastStep
                ? isLastStage
                  ? t("umrah.completeUmrah")
                  : t("umrah.nextStage", { name: t(UMRAH_STAGES[stageIndex + 1]?.titleKey || "") })
                : t("a11y.umrah.progress", { current: currentStep + 2, total: totalSteps })
            }>
            <ButtonText>
              {isLastStep
                ? isLastStage
                  ? t("umrah.completeUmrah")
                  : t("umrah.nextStage", { name: t(UMRAH_STAGES[stageIndex + 1]?.titleKey || "") })
                : t("umrah.continue")}
            </ButtonText>
          </Button>

          {!isLastStep && (
            <Pressable
              onPress={handleOverview}
              padding="$3"
              borderRadius="$3"
              backgroundColor="$backgroundSecondary"
              minWidth={48}
              minHeight={48}
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("umrah.overview")}>
              <Text size="xs" color="$typographySecondary">
                {t("umrah.overview")}
              </Text>
            </Pressable>
          )}
        </HStack>
      </Box>
    </Background>
  );
}

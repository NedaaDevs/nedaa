import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { useAppStore } from "@/stores/app";
import { useHaptic } from "@/hooks/useHaptic";

import type { SubStep } from "@/types/umrah";

type Props = {
  step: SubStep;
};

const StepCard = ({ step }: Props) => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const selectionHaptic = useHaptic("selection");
  const [isFlipped, setIsFlipped] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const flipValue = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Reset flip when step changes
  useEffect(() => {
    setIsFlipped(false);
    flipValue.value = withTiming(0, { duration: 0 });
  }, [step.id, flipValue]);

  const handleFlip = async () => {
    if (!step.dua) return;
    await selectionHaptic();
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);

    if (!reduceMotion) {
      flipValue.value = withTiming(newFlipped ? 180 : 0, { duration: 400 });
    } else {
      flipValue.value = newFlipped ? 180 : 0;
    }
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flipValue.value, [0, 180], [0, 180])}deg` }],
    backfaceVisibility: "hidden" as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flipValue.value, [0, 180], [180, 360])}deg` }],
    backfaceVisibility: "hidden" as const,
  }));

  // Instruction type — no flip
  if (step.type === "instruction") {
    return (
      <Box flex={1} justifyContent="center" paddingHorizontal="$4">
        <Box padding="$6" borderRadius="$4" backgroundColor="$backgroundSecondary">
          <VStack gap="$3" alignItems="center">
            <Text size="xl" fontWeight="700" color="$typography" textAlign="center">
              {t(step.titleKey)}
            </Text>
            {step.descriptionKey && (
              <Text size="md" color="$typographySecondary" textAlign="center">
                {t(step.descriptionKey)}
              </Text>
            )}
          </VStack>
        </Box>
      </Box>
    );
  }

  // Lap type — show lap number + dua
  if (step.type === "lap") {
    const directionLabel =
      step.lapDirection === "safaToMarwa"
        ? t("umrah.safaToMarwa")
        : step.lapDirection === "marwaToSafa"
          ? t("umrah.marwaToSafa")
          : undefined;

    return (
      <Box flex={1} justifyContent="center" paddingHorizontal="$4">
        <VStack gap="$4" alignItems="center">
          {/* Lap number badge */}
          <Box
            width={64}
            height={64}
            borderRadius={32}
            backgroundColor="$accentPrimary"
            alignItems="center"
            justifyContent="center">
            <Text size="2xl" fontWeight="700" color="white">
              {step.lapNumber}
            </Text>
          </Box>

          <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
            {t(step.titleKey, { number: step.lapNumber })}
          </Text>

          {directionLabel && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {directionLabel}
            </Text>
          )}

          {/* Dua card (flippable) */}
          {step.dua && (
            <Pressable
              onPress={handleFlip}
              width="100%"
              accessibilityRole="button"
              accessibilityLabel={t("a11y.umrah.tapToTranslate")}
              accessibilityHint={t("a11y.umrah.tapToTranslate")}>
              <Box height={180}>
                {/* Front — Arabic */}
                <Animated.View
                  style={[{ position: "absolute", width: "100%", height: "100%" }, frontStyle]}>
                  <Box
                    flex={1}
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="center"
                    alignItems="center">
                    <Text size="xl" color="$typography" textAlign="center" lineHeight={36}>
                      {step.dua.arabic}
                    </Text>
                  </Box>
                </Animated.View>

                {/* Back — Translation */}
                <Animated.View
                  style={[{ position: "absolute", width: "100%", height: "100%" }, backStyle]}>
                  <Box
                    flex={1}
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="center"
                    alignItems="center">
                    <VStack gap="$2" alignItems="center">
                      {locale !== "ar" && step.dua.transliteration[locale] && (
                        <Text size="sm" color="$typographySecondary" textAlign="center">
                          {step.dua.transliteration[locale]}
                        </Text>
                      )}
                      <Text size="md" color="$typography" textAlign="center">
                        {step.dua.translation[locale] || step.dua.translation.en}
                      </Text>
                    </VStack>
                  </Box>
                </Animated.View>
              </Box>
            </Pressable>
          )}

          {step.dua && (
            <Text size="xs" color="$typographySecondary">
              {step.dua.source}
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  // Dua type — full flippable card
  if (step.type === "dua" && step.dua) {
    return (
      <Box flex={1} justifyContent="center" paddingHorizontal="$4">
        <VStack gap="$3" alignItems="center">
          <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
            {t(step.titleKey)}
          </Text>

          {step.descriptionKey && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {t(step.descriptionKey)}
            </Text>
          )}

          <Pressable
            onPress={handleFlip}
            width="100%"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.umrah.tapToTranslate")}
            accessibilityHint={t("a11y.umrah.tapToTranslate")}>
            <Box height={240}>
              {/* Front — Arabic */}
              <Animated.View
                style={[{ position: "absolute", width: "100%", height: "100%" }, frontStyle]}>
                <Box
                  flex={1}
                  padding="$6"
                  borderRadius="$4"
                  backgroundColor="$backgroundSecondary"
                  justifyContent="center"
                  alignItems="center">
                  <Text size="2xl" color="$typography" textAlign="center" lineHeight={42}>
                    {step.dua.arabic}
                  </Text>
                </Box>
              </Animated.View>

              {/* Back — Translation */}
              <Animated.View
                style={[{ position: "absolute", width: "100%", height: "100%" }, backStyle]}>
                <Box
                  flex={1}
                  padding="$6"
                  borderRadius="$4"
                  backgroundColor="$backgroundSecondary"
                  justifyContent="center"
                  alignItems="center">
                  <VStack gap="$3" alignItems="center">
                    {locale !== "ar" && step.dua.transliteration[locale] && (
                      <Text size="sm" color="$typographySecondary" textAlign="center">
                        {step.dua.transliteration[locale]}
                      </Text>
                    )}
                    <Text size="md" color="$typography" textAlign="center">
                      {step.dua.translation[locale] || step.dua.translation.en}
                    </Text>
                  </VStack>
                </Box>
              </Animated.View>
            </Box>
          </Pressable>

          <Text size="xs" color="$typographySecondary">
            {step.dua.source}
          </Text>
        </VStack>
      </Box>
    );
  }

  return null;
};

export default StepCard;

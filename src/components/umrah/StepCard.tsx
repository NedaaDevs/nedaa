import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { formatNumberToLocale } from "@/utils/number";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useAppStore } from "@/stores/app";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";
import FlipHint from "./FlipHint";
import HadithReference from "./HadithReference";

import { ExternalLink } from "lucide-react-native";
import type { SubStep } from "@/types/umrah";

type Props = {
  step: SubStep;
};

const StepCard = ({ step }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useAppStore();
  const { hasSeenFlipHint } = useUmrahGuideStore();
  const selectionHaptic = useHaptic("selection");
  const [isFlipped, setIsFlipped] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const flipValue = useSharedValue(0);

  const isArabic = locale === "ar";

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

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

  // Reference type — link to prepare screens
  if (step.type === "reference" && step.route) {
    return (
      <Box flex={1} justifyContent="center" paddingHorizontal="$4">
        <Pressable
          onPress={async () => {
            await selectionHaptic();
            router.push(step.route as any);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t(step.titleKey)} — ${t("a11y.umrah.viewReference")}`}
          accessibilityHint={t("a11y.umrah.opensGuideHint")}>
          <Box
            padding="$6"
            borderRadius="$4"
            backgroundColor="$backgroundSecondary"
            style={{ borderCurve: "continuous" }}>
            <VStack gap="$3" alignItems="center">
              <Text size="xl" fontWeight="700" color="$typography" textAlign="center">
                {t(step.titleKey)}
              </Text>
              {step.descriptionKey && (
                <Text size="md" color="$typographySecondary" textAlign="center">
                  {t(step.descriptionKey)}
                </Text>
              )}
              <HStack alignItems="center" gap="$1.5" paddingTop="$2">
                <Icon as={ExternalLink} size="sm" color="$accentPrimary" />
                <Text size="sm" fontWeight="600" color="$accentPrimary">
                  {t("a11y.umrah.viewReference")}
                </Text>
              </HStack>
            </VStack>
          </Box>
        </Pressable>
      </Box>
    );
  }

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
          <Box
            width={64}
            height={64}
            borderRadius={32}
            backgroundColor="$accentPrimary"
            alignItems="center"
            justifyContent="center">
            <Text size="2xl" fontWeight="700" color="white">
              {formatNumberToLocale(String(step.lapNumber ?? ""))}
            </Text>
          </Box>

          <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
            {t(step.titleKey, { number: formatNumberToLocale(String(step.lapNumber ?? "")) })}
          </Text>

          {directionLabel && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {directionLabel}
            </Text>
          )}

          {step.descriptionKey && (
            <Text size="xs" color="$typographySecondary" textAlign="center">
              {t(step.descriptionKey)}
            </Text>
          )}

          {step.dua && (
            <Pressable
              onPress={handleFlip}
              width="100%"
              accessibilityRole="button"
              accessibilityLabel={
                isArabic ? t("a11y.umrah.tapToShowSource") : t("a11y.umrah.tapToTranslate")
              }
              accessibilityHint={t("a11y.umrah.flipCardHint")}
              accessibilityState={{ expanded: isFlipped }}>
              <Box minHeight={180} style={{ position: "relative" }}>
                {/* Front — Arabic */}
                <Animated.View
                  style={[{ position: "absolute", width: "100%", minHeight: 180 }, frontStyle]}>
                  <Box
                    flex={1}
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="center"
                    alignItems="center"
                    minHeight={180}>
                    <Text
                      size="xl"
                      color="$typography"
                      textAlign="center"
                      lineHeight={36}
                      selectable>
                      {step.dua.arabic}
                    </Text>
                  </Box>
                </Animated.View>

                {/* Back — locale-aware */}
                <Animated.View
                  style={[{ position: "absolute", width: "100%", minHeight: 180 }, backStyle]}>
                  <Box
                    flex={1}
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$backgroundSecondary"
                    justifyContent="center"
                    alignItems="center"
                    minHeight={180}>
                    <VStack gap="$2" alignItems="center">
                      <FlipBackContent step={step} locale={locale} isArabic={isArabic} />
                    </VStack>
                  </Box>
                </Animated.View>

                {!hasSeenFlipHint && <FlipHint />}
              </Box>
            </Pressable>
          )}

          {step.dua && !isArabic && step.dua.hadithSource && (
            <HadithReference
              hadithSource={step.dua.hadithSource}
              hadithTranslation={step.dua.hadithTranslation}
            />
          )}

          {step.dua && isArabic && (
            <Text size="xs" color="$typographySecondary">
              {t(step.dua.source)}
            </Text>
          )}
          <Text size="xs" color="$typographyTertiary" textAlign="center">
            {t("umrah.duaNote")}
          </Text>
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

          {step.dua.repeatCount && step.dua.repeatCount > 1 && (
            <Text
              size="xs"
              color="$accentPrimary"
              fontWeight="600"
              accessibilityLabel={t("a11y.umrah.repeatCount", { count: step.dua.repeatCount })}>
              ×{formatNumberToLocale(step.dua.repeatCount.toString())}
            </Text>
          )}

          <Pressable
            onPress={handleFlip}
            width="100%"
            accessibilityRole="button"
            accessibilityLabel={
              isArabic ? t("a11y.umrah.tapToShowSource") : t("a11y.umrah.tapToTranslate")
            }
            accessibilityHint={t("a11y.umrah.flipCardHint")}
            accessibilityState={{ expanded: isFlipped }}>
            <Box minHeight={240} style={{ position: "relative" }}>
              {/* Front — Arabic */}
              <Animated.View
                style={[{ position: "absolute", width: "100%", minHeight: 240 }, frontStyle]}>
                <Box
                  flex={1}
                  padding="$6"
                  borderRadius="$4"
                  backgroundColor="$backgroundSecondary"
                  justifyContent="center"
                  alignItems="center"
                  minHeight={240}>
                  <Text
                    size="2xl"
                    color="$typography"
                    textAlign="center"
                    lineHeight={42}
                    selectable>
                    {step.dua.arabic}
                  </Text>
                </Box>
              </Animated.View>

              {/* Back — locale-aware */}
              <Animated.View
                style={[{ position: "absolute", width: "100%", minHeight: 240 }, backStyle]}>
                <Box
                  flex={1}
                  padding="$6"
                  borderRadius="$4"
                  backgroundColor="$backgroundSecondary"
                  justifyContent="center"
                  alignItems="center"
                  minHeight={240}>
                  <VStack gap="$3" alignItems="center">
                    <FlipBackContent step={step} locale={locale} isArabic={isArabic} />
                  </VStack>
                </Box>
              </Animated.View>

              {!hasSeenFlipHint && <FlipHint />}
            </Box>
          </Pressable>

          {!isArabic && step.dua.hadithSource && (
            <HadithReference
              hadithSource={step.dua.hadithSource}
              hadithTranslation={step.dua.hadithTranslation}
            />
          )}

          {isArabic && (
            <Text size="xs" color="$typographySecondary">
              {t(step.dua.source)}
            </Text>
          )}
          <Text size="xs" color="$typographyTertiary" textAlign="center">
            {t("umrah.duaNote")}
          </Text>
        </VStack>
      </Box>
    );
  }

  return null;
};

const FlipBackContent = ({
  step,
  locale,
  isArabic,
}: {
  step: SubStep;
  locale: string;
  isArabic: boolean;
}) => {
  if (!step.dua) return null;

  if (isArabic) {
    if (step.dua.hadithSource) {
      return (
        <>
          <Text size="md" color="$typography" textAlign="center" selectable>
            {step.dua.hadithSource}
          </Text>
          {step.dua.translation.ar && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {step.dua.translation.ar}
            </Text>
          )}
        </>
      );
    }
    return (
      <Text size="md" color="$typography" textAlign="center">
        {step.dua.translation.ar || t(step.dua.source)}
      </Text>
    );
  }

  return (
    <>
      {step.dua.transliteration[locale] && (
        <Text size="sm" color="$typographySecondary" textAlign="center" selectable>
          {step.dua.transliteration[locale]}
        </Text>
      )}
      <Text size="md" color="$typography" textAlign="center" selectable>
        {step.dua.translation[locale] || step.dua.translation.en}
      </Text>
    </>
  );
};

export default StepCard;

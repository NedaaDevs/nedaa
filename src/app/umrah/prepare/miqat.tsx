import { useState, useEffect } from "react";
import { AccessibilityInfo, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";

import { MapPin, Plane, ChevronRight } from "lucide-react-native";
import { MIQAT_POINTS } from "@/constants/UmrahMiqat";
import { useHaptic } from "@/hooks/useHaptic";
import type { MiqatPoint } from "@/types/umrah";

type Step = "origin" | "direction" | "result";

const DIRECTION_KEYS: Record<string, string> = {
  madinah: "umrah.prepare.miqat.fromMadinah",
  syria: "umrah.prepare.miqat.fromSyria",
  egypt: "umrah.prepare.miqat.fromSyria",
  maghreb: "umrah.prepare.miqat.fromSyria",
  yemen: "umrah.prepare.miqat.fromYemen",
  najd: "umrah.prepare.miqat.fromNajd",
  riyadh: "umrah.prepare.miqat.fromNajd",
  iraq: "umrah.prepare.miqat.fromIraq",
  east: "umrah.prepare.miqat.fromIraq",
};

export default function MiqatScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const [step, setStep] = useState<Step>("origin");
  const [selectedMiqat, setSelectedMiqat] = useState<MiqatPoint | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const isArabic = i18n.language === "ar";

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const outsideMiqats = MIQAT_POINTS.filter((m) => !m.isInsideMakkah);
  const insideMiqat = MIQAT_POINTS.find((m) => m.isInsideMakkah);

  const uniqueDirectionGroups = outsideMiqats.reduce<{ key: string; miqat: MiqatPoint }[]>(
    (acc, miqat) => {
      const dirKey = DIRECTION_KEYS[miqat.fromDirections[0]];
      if (dirKey && !acc.some((g) => g.key === dirKey)) {
        acc.push({ key: dirKey, miqat });
      }
      return acc;
    },
    []
  );

  const handleOriginSelect = async (isInside: boolean) => {
    await selectionHaptic();
    if (isInside && insideMiqat) {
      setSelectedMiqat(insideMiqat);
      setStep("result");
    } else {
      setStep("direction");
    }
  };

  const handleDirectionSelect = async (miqat: MiqatPoint) => {
    await selectionHaptic();
    setSelectedMiqat(miqat);
    setStep("result");
  };

  const handleReset = async () => {
    await selectionHaptic();
    setStep("origin");
    setSelectedMiqat(null);
  };

  return (
    <Background>
      <TopBar title="umrah.prepare.miqat" backOnClick />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
        {step === "origin" && (
          <Animated.View entering={reduceMotion ? FadeIn.duration(1) : FadeIn.duration(300)}>
            <VStack gap="$3" paddingTop="$4">
              <Pressable
                onPress={() => handleOriginSelect(false)}
                accessibilityRole="button"
                accessibilityLabel={t("umrah.prepare.miqat.fromOutside")}>
                <HStack
                  padding="$4"
                  borderRadius="$3"
                  backgroundColor="$backgroundSecondary"
                  style={{ borderCurve: "continuous" }}
                  alignItems="center"
                  gap="$3">
                  <Icon as={MapPin} size="md" color="$accentPrimary" />
                  <Text size="md" fontWeight="600" color="$typography" flex={1}>
                    {t("umrah.prepare.miqat.fromOutside")}
                  </Text>
                  <Icon as={ChevronRight} size="sm" color="$typographySecondary" />
                </HStack>
              </Pressable>

              <Pressable
                onPress={() => handleOriginSelect(true)}
                accessibilityRole="button"
                accessibilityLabel={t("umrah.prepare.miqat.fromInside")}>
                <HStack
                  padding="$4"
                  borderRadius="$3"
                  backgroundColor="$backgroundSecondary"
                  style={{ borderCurve: "continuous" }}
                  alignItems="center"
                  gap="$3">
                  <Icon as={MapPin} size="md" color="$accentPrimary" />
                  <Text size="md" fontWeight="600" color="$typography" flex={1}>
                    {t("umrah.prepare.miqat.fromInside")}
                  </Text>
                  <Icon as={ChevronRight} size="sm" color="$typographySecondary" />
                </HStack>
              </Pressable>

              <Box
                padding="$3"
                borderRadius="$3"
                backgroundColor="$backgroundSecondary"
                style={{ borderCurve: "continuous" }}>
                <HStack alignItems="center" gap="$2">
                  <Icon as={Plane} size="sm" color="$typographySecondary" />
                  <VStack flex={1} gap="$0.5">
                    <Text size="sm" fontWeight="600" color="$typography">
                      {t("umrah.prepare.miqat.byAirplane")}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {t("umrah.prepare.miqat.byAirplaneDesc")}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            </VStack>
          </Animated.View>
        )}

        {step === "direction" && (
          <Animated.View entering={reduceMotion ? FadeIn.duration(1) : FadeIn.duration(300)}>
            <VStack gap="$3" paddingTop="$4">
              {uniqueDirectionGroups.map(({ key, miqat }) => (
                <Pressable
                  key={miqat.id}
                  onPress={() => handleDirectionSelect(miqat)}
                  accessibilityRole="button"
                  accessibilityLabel={t(key)}>
                  <HStack
                    padding="$4"
                    borderRadius="$3"
                    backgroundColor="$backgroundSecondary"
                    style={{ borderCurve: "continuous" }}
                    alignItems="center"
                    gap="$3">
                    <VStack flex={1} gap="$0.5">
                      <Text size="md" fontWeight="600" color="$typography">
                        {t(key)}
                      </Text>
                      <Text size="xs" color="$typographySecondary">
                        {isArabic ? miqat.nameAr : miqat.nameEn}
                        {miqat.alternateNameAr && isArabic
                          ? ` (${miqat.alternateNameAr})`
                          : miqat.alternateNameEn
                            ? ` (${miqat.alternateNameEn})`
                            : ""}
                      </Text>
                    </VStack>
                    <Icon as={ChevronRight} size="sm" color="$typographySecondary" />
                  </HStack>
                </Pressable>
              ))}

              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.umrah.backToPrevious")}
                style={{ minHeight: 44, justifyContent: "center" }}>
                <Text size="sm" color="$typographySecondary" textAlign="center" paddingTop="$2">
                  ← {t("a11y.back")}
                </Text>
              </Pressable>
            </VStack>
          </Animated.View>
        )}

        {step === "result" && selectedMiqat && (
          <Animated.View entering={reduceMotion ? FadeIn.duration(1) : FadeIn.duration(300)}>
            <VStack gap="$4" paddingTop="$4">
              <Text size="md" fontWeight="600" color="$typography">
                {t("umrah.prepare.miqat.result")}
              </Text>

              <Box
                padding="$5"
                borderRadius="$4"
                backgroundColor="$backgroundSecondary"
                style={{ borderCurve: "continuous" }}
                gap="$3"
                alignItems="center"
                accessible
                accessibilityLabel={`${isArabic ? selectedMiqat.nameAr : selectedMiqat.nameEn}${(isArabic ? selectedMiqat.alternateNameAr : selectedMiqat.alternateNameEn) ? `, ${isArabic ? selectedMiqat.alternateNameAr : selectedMiqat.alternateNameEn}` : ""}, ${t("umrah.prepare.miqat.distanceKm", { distance: selectedMiqat.distanceFromMakkahKm })}`}>
                <Icon as={MapPin} size="xl" color="$accentPrimary" />
                <Text size="xl" fontWeight="700" color="$typography" textAlign="center" selectable>
                  {isArabic ? selectedMiqat.nameAr : selectedMiqat.nameEn}
                </Text>
                {(isArabic ? selectedMiqat.alternateNameAr : selectedMiqat.alternateNameEn) && (
                  <Text size="sm" color="$typographySecondary" textAlign="center">
                    {isArabic ? selectedMiqat.alternateNameAr : selectedMiqat.alternateNameEn}
                  </Text>
                )}
                <Text
                  size="sm"
                  color="$typographySecondary"
                  style={{ fontVariant: ["tabular-nums"] }}>
                  {t("umrah.prepare.miqat.distanceKm", {
                    distance: selectedMiqat.distanceFromMakkahKm,
                  })}
                </Text>

                {selectedMiqat.isInsideMakkah && (
                  <Text size="sm" color="$typographySecondary" textAlign="center" paddingTop="$2">
                    {t("umrah.prepare.miqat.insideResult")}
                  </Text>
                )}
              </Box>

              <Button
                size="lg"
                onPress={() => router.push("/umrah")}
                accessibilityRole="button"
                accessibilityLabel={t("umrah.prepare.startUmrah")}>
                <Button.Text>{t("umrah.prepare.startUmrah")}</Button.Text>
              </Button>

              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.umrah.backToPrevious")}
                style={{ minHeight: 44, justifyContent: "center" }}>
                <Text size="sm" color="$typographySecondary" textAlign="center">
                  ← {t("a11y.back")}
                </Text>
              </Pressable>
            </VStack>
          </Animated.View>
        )}
      </ScrollView>
    </Background>
  );
}

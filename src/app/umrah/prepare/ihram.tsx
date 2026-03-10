import { useState, useEffect } from "react";
import { AccessibilityInfo, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import TopBar from "@/components/TopBar";
import IhramMale from "@/components/umrah/illustrations/IhramMale";
import IhramFemale from "@/components/umrah/illustrations/IhramFemale";

import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";
import type { Gender } from "@/types/umrah";

export default function IhramScreen() {
  const { t } = useTranslation();
  const selectionHaptic = useHaptic("selection");
  const { selectedGender, setSelectedGender } = useUmrahGuideStore();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const handleGenderSelect = async (gender: Gender) => {
    await selectionHaptic();
    setSelectedGender(gender);
  };

  return (
    <Background>
      <TopBar title="umrah.prepare.ihram" backOnClick />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 20 }}>
        <HStack
          gap="$3"
          paddingTop="$4"
          accessibilityRole="radiogroup"
          accessibilityLabel={t("a11y.umrah.genderSelect")}>
          {(["male", "female"] as const).map((gender) => (
            <Pressable
              key={gender}
              flex={1}
              onPress={() => handleGenderSelect(gender)}
              accessibilityRole="radio"
              accessibilityLabel={t(`umrah.prepare.gender.${gender}`)}
              accessibilityState={{ selected: selectedGender === gender }}>
              <Box
                padding="$4"
                borderRadius="$3"
                backgroundColor={
                  selectedGender === gender ? "$accentPrimary" : "$backgroundSecondary"
                }
                style={{ borderCurve: "continuous" }}
                alignItems="center"
                gap="$2"
                opacity={selectedGender === gender ? 1 : 0.7}>
                <Text
                  size="lg"
                  fontWeight="700"
                  color={selectedGender === gender ? "white" : "$typography"}>
                  {t(`umrah.prepare.gender.${gender}`)}
                </Text>
              </Box>
            </Pressable>
          ))}
        </HStack>

        {selectedGender && (
          <Animated.View entering={reduceMotion ? FadeIn.duration(1) : FadeIn.duration(300)}>
            <VStack gap="$4">
              <Box
                alignItems="center"
                paddingVertical="$2"
                accessible={false}
                importantForAccessibility="no-hide-descendants">
                {selectedGender === "male" ? <IhramMale size={180} /> : <IhramFemale size={180} />}
              </Box>

              <VStack gap="$3">
                <Text size="md" fontWeight="600" color="$typography">
                  {t(
                    `umrah.prepare.ihram.${selectedGender === "male" ? "menTitle" : "womenTitle"}`
                  )}
                </Text>

                {selectedGender === "male" ? (
                  <VStack gap="$2.5">
                    <NumberedItem n={1} text={t("umrah.prepare.ihram.menRida")} />
                    <NumberedItem n={2} text={t("umrah.prepare.ihram.menIzar")} />
                    <Text size="xs" color="$typographySecondary" paddingTop="$1">
                      {t("umrah.prepare.ihram.menRules")}
                    </Text>
                  </VStack>
                ) : (
                  <VStack gap="$2.5">
                    <NumberedItem n={1} text={t("umrah.prepare.ihram.womenHijab")} />
                    <NumberedItem n={2} text={t("umrah.prepare.ihram.womenHands")} />
                    <Text size="xs" color="$typographySecondary" paddingTop="$1">
                      {t("umrah.prepare.ihram.womenClothing")}
                    </Text>
                  </VStack>
                )}
              </VStack>

              <Divider />

              <VStack gap="$3">
                <Text size="md" fontWeight="600" color="$typography">
                  {t("umrah.prepare.ihram.ghusl")}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {t("umrah.prepare.ihram.ghuslDesc")}
                </Text>
              </VStack>

              <Divider />

              <VStack gap="$3">
                <Text size="md" fontWeight="600" color="$typography">
                  {t("umrah.prepare.ihram.niyyahTitle")}
                </Text>
                <Box
                  padding="$4"
                  borderRadius="$3"
                  backgroundColor="$backgroundSecondary"
                  style={{ borderCurve: "continuous" }}>
                  <Text
                    size="lg"
                    fontWeight="600"
                    color="$typography"
                    textAlign="center"
                    selectable>
                    {t("umrah.prepare.ihram.niyyahText")}
                  </Text>
                </Box>
              </VStack>

              <Divider />

              <VStack gap="$3">
                <Text size="md" fontWeight="600" color="$typography">
                  {t("umrah.prepare.ihram.ishtiraat")}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {t("umrah.prepare.ihram.ishtiraatDesc")}
                </Text>
                <Box
                  padding="$4"
                  borderRadius="$3"
                  backgroundColor="$backgroundSecondary"
                  style={{ borderCurve: "continuous" }}>
                  <Text
                    size="lg"
                    fontWeight="600"
                    color="$typography"
                    textAlign="center"
                    selectable>
                    {t("umrah.prepare.ihram.ishtiraatText")}
                  </Text>
                </Box>
              </VStack>
            </VStack>
          </Animated.View>
        )}

        {!selectedGender && (
          <Box padding="$6" alignItems="center">
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {t("umrah.prepare.gender.select")}
            </Text>
          </Box>
        )}
      </ScrollView>
    </Background>
  );
}

const NumberedItem = ({ n, text }: { n: number; text: string }) => (
  <HStack gap="$3" alignItems="flex-start" accessible accessibilityLabel={text}>
    <Box
      width={24}
      height={24}
      borderRadius={12}
      borderWidth={1.5}
      borderColor="$accentPrimary"
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      importantForAccessibility="no-hide-descendants">
      <Text size="xs" fontWeight="700" color="$accentPrimary">
        {n}
      </Text>
    </Box>
    <Text
      size="sm"
      color="$typographySecondary"
      flex={1}
      paddingTop="$0.5"
      importantForAccessibility="no">
      {text}
    </Text>
  </HStack>
);

const Divider = () => <Box height={1} backgroundColor="$outline" opacity={0.3} />;

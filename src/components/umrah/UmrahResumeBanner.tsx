import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { MotiView } from "moti";

import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { ChevronRight, ChevronLeft } from "lucide-react-native";
import ProgressRing from "@/components/umrah/ProgressRing";

import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { UMRAH_STAGES } from "@/constants/UmrahGuide";
import { useHaptic } from "@/hooks/useHaptic";

const UmrahResumeBanner = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const { activeProgress, getProgressFraction } = useUmrahGuideStore();

  if (!activeProgress) return null;

  const currentStage = UMRAH_STAGES[activeProgress.currentStageIndex];
  if (!currentStage) return null;

  const progress = getProgressFraction();
  const isRTL = i18n.dir() === "rtl";
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const handlePress = async () => {
    await selectionHaptic();
    router.push("/umrah" as any);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 250 }}>
      <Pressable
        onPress={handlePress}
        marginHorizontal="$2"
        marginBottom="$2"
        padding="$3"
        borderRadius="$4"
        backgroundColor="$backgroundSecondary"
        accessibilityRole="button"
        accessibilityLabel={t("umrah.resumeBanner.a11yLabel", {
          stage: t(currentStage.titleKey),
        })}
        accessibilityHint={t("umrah.resumeBanner.a11yHint")}>
        <HStack alignItems="center" gap="$3">
          <ProgressRing progress={progress} size="md" />
          <VStack flex={1} gap="$0.5">
            <Text size="sm" fontWeight="600" color="$typography">
              {t(currentStage.titleKey)}
            </Text>
            <Text size="xs" color="$typographySecondary">
              {t("umrah.resumeBanner.tapToContinue")}
            </Text>
          </VStack>
          <Icon as={Chevron} size="sm" color="$typographySecondary" />
        </HStack>
      </Pressable>
    </MotiView>
  );
};

export default UmrahResumeBanner;

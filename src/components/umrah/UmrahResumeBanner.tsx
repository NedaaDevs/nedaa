import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { MotiView } from "moti";

import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { X } from "lucide-react-native";
import ProgressRing from "@/components/umrah/ProgressRing";

import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { UMRAH_STAGES } from "@/constants/UmrahGuide";
import { useHaptic } from "@/hooks/useHaptic";

const UmrahResumeBanner = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const { activeProgress, getProgressFraction, resetProgress } = useUmrahGuideStore();

  if (!activeProgress) return null;

  const currentStage = UMRAH_STAGES[activeProgress.currentStageIndex];
  if (!currentStage) return null;

  const progress = getProgressFraction();
  const handlePress = async () => {
    await selectionHaptic();
    router.push("/umrah" as any);
  };

  const handleDismiss = async () => {
    await selectionHaptic();
    Alert.alert(t("umrah.endUmrah.title"), t("umrah.endUmrah.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("umrah.endUmrah.confirm"),
        style: "destructive",
        onPress: resetProgress,
      },
    ]);
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
          <Pressable
            onPress={handleDismiss}
            hitSlop={10}
            padding="$1.5"
            borderRadius="$10"
            accessibilityRole="button"
            accessibilityLabel={t("umrah.resumeBanner.dismissA11yLabel")}>
            <Icon as={X} size="sm" color="$typographySecondary" />
          </Pressable>
        </HStack>
      </Pressable>
    </MotiView>
  );
};

export default UmrahResumeBanner;

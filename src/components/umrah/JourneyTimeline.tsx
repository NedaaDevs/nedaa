import { useTranslation } from "react-i18next";
import { MotiView } from "moti";
import { useTheme } from "tamagui";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Check } from "lucide-react-native";

import { UMRAH_STAGES } from "@/constants/UmrahGuide";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

type Props = {
  onStagePress: (stageIndex: number) => void;
};

const JourneyTimeline = ({ onStagePress }: Props) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { activeProgress, isStageCompleted } = useUmrahGuideStore();

  const getStageState = (index: number) => {
    if (!activeProgress) return "locked";
    const stage = UMRAH_STAGES[index];
    if (isStageCompleted(stage.id)) return "completed";
    if (activeProgress.currentStageIndex === index) return "active";
    if (index < activeProgress.currentStageIndex) return "completed";
    return "locked";
  };

  return (
    <VStack paddingHorizontal="$4" paddingVertical="$2" gap="$0">
      {UMRAH_STAGES.map((stage, index) => {
        const state = getStageState(index);
        const isLast = index === UMRAH_STAGES.length - 1;

        return (
          <Pressable
            key={stage.id}
            onPress={() => onStagePress(index)}
            disabled={state === "locked"}
            accessibilityRole="button"
            accessibilityLabel={t(stage.titleKey)}
            accessibilityHint={state === "locked" ? undefined : t("a11y.umrah.tapToStart")}
            accessibilityState={{ disabled: state === "locked" }}
            opacity={state === "locked" ? 0.5 : 1}>
            <HStack gap="$3" alignItems="flex-start">
              {/* Timeline line + node */}
              <VStack alignItems="center" width={32}>
                {/* Node */}
                {state === "active" ? (
                  <MotiView
                    from={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "timing",
                      duration: 1000,
                      loop: true,
                    }}>
                    <Box
                      width={32}
                      height={32}
                      borderRadius={16}
                      backgroundColor="$accentPrimary"
                      alignItems="center"
                      justifyContent="center">
                      <Box width={12} height={12} borderRadius={6} backgroundColor="white" />
                    </Box>
                  </MotiView>
                ) : state === "completed" ? (
                  <Box
                    width={32}
                    height={32}
                    borderRadius={16}
                    backgroundColor="$accentPrimary"
                    alignItems="center"
                    justifyContent="center">
                    <Icon as={Check} size="sm" color="white" />
                  </Box>
                ) : (
                  <Box
                    width={32}
                    height={32}
                    borderRadius={16}
                    borderWidth={2}
                    borderColor="$outline"
                    alignItems="center"
                    justifyContent="center">
                    <Box width={12} height={12} borderRadius={6} backgroundColor="$outline" />
                  </Box>
                )}

                {/* Connector line */}
                {!isLast && (
                  <Box
                    width={2}
                    height={48}
                    backgroundColor={
                      state === "completed" ? theme.accentPrimary.val : theme.outline.val
                    }
                  />
                )}
              </VStack>

              {/* Stage content */}
              <VStack flex={1} paddingBottom={isLast ? "$0" : "$4"} gap="$0.5">
                <Text
                  size="lg"
                  fontWeight="600"
                  color={state === "locked" ? "$typographySecondary" : "$typography"}>
                  {t(stage.titleKey)}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {t(stage.subtitleKey)}
                </Text>
              </VStack>
            </HStack>
          </Pressable>
        );
      })}
    </VStack>
  );
};

export default JourneyTimeline;

import { FC } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

import { Minus, Check } from "lucide-react-native";

import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useHaptic } from "@/hooks/useHaptic";
import { formatNumberToLocale } from "@/utils/number";

import type { CustomAthkarProgress } from "@/types/athkar";

type Props = {
  customItemId: number;
  arabicText: string;
  progress: CustomAthkarProgress;
};

const CustomAthkarCard: FC<Props> = ({ customItemId, arabicText, progress }) => {
  const { t, i18n } = useTranslation();
  const { incrementCount, incrementCountBy, decrementCount } = useCustomAthkarStore();
  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const isRTL = i18n.dir() === "rtl";
  const { currentCount, totalCount, completed } = progress;
  const progressPercentage = (currentCount / totalCount) * 100;

  const handleIncrement = () => {
    if (completed) return;
    hapticSelection();
    incrementCount(customItemId);
    if (currentCount + 1 >= totalCount) {
      hapticSuccess();
    }
  };

  const handleLongPress = () => {
    if (completed) return;
    hapticMedium();
    incrementCountBy(customItemId, 10);
    if (currentCount + 10 >= totalCount) {
      hapticSuccess();
    }
  };

  return (
    <Pressable
      onPress={handleIncrement}
      onLongPress={handleLongPress}
      delayLongPress={400}
      disabled={completed}
      accessibilityRole="button"
      accessibilityLabel={
        completed
          ? t("a11y.customAthkar.cardComplete")
          : t("a11y.customAthkar.cardProgress", { current: currentCount, total: totalCount })
      }
      accessibilityHint={completed ? undefined : t("a11y.customAthkar.tapToCount")}>
      <Box
        padding="$4"
        borderRadius="$6"
        position="relative"
        backgroundColor={completed ? "$backgroundSuccess" : "$backgroundSecondary"}
        borderWidth={completed ? 2 : 0}
        borderColor={completed ? "$success" : "transparent"}>
        <VStack gap="$3">
          <Text
            size="xl"
            style={{ writingDirection: "rtl", lineHeight: 36 }}
            textAlign="left"
            color={completed ? "$typographySecondary" : "$typography"}>
            {arabicText}
          </Text>

          <VStack gap="$2">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$2" alignItems="center">
                {currentCount > 0 && (
                  <Button
                    size="xs"
                    variant="outline"
                    action="default"
                    onPress={(e: any) => {
                      e.stopPropagation();
                      decrementCount(customItemId);
                      hapticWarning();
                    }}
                    width={44}
                    height={44}
                    padding={0}
                    borderRadius={999}
                    backgroundColor={completed ? "$backgroundMuted" : "transparent"}
                    borderColor={completed ? "$outlineSecondary" : "$info"}
                    accessibilityRole="button"
                    accessibilityLabel={t("a11y.customAthkar.decrementCount")}>
                    <Icon as={Minus} color="$info" />
                  </Button>
                )}
              </HStack>

              <Text
                size="md"
                fontWeight="500"
                color={completed ? "$typographyContrast" : "$typographySecondary"}>
                {isRTL
                  ? `${formatNumberToLocale(`${totalCount}`)} / ${formatNumberToLocale(`${currentCount}`)}`
                  : `${formatNumberToLocale(`${currentCount}`)} / ${formatNumberToLocale(`${totalCount}`)}`}
              </Text>
            </HStack>

            <Progress value={progressPercentage} size="md" backgroundColor="$backgroundMuted">
              <ProgressFilledTrack
                backgroundColor={completed ? "$typographyContrast" : "$primary"}
              />
            </Progress>
          </VStack>
        </VStack>

        {completed && (
          <Box
            position="absolute"
            top={-8}
            end={-8}
            width={40}
            height={40}
            borderRadius={999}
            backgroundColor="$success"
            alignItems="center"
            justifyContent="center">
            <Icon as={Check} color="$typographyContrast" />
          </Box>
        )}
      </Box>
    </Pressable>
  );
};

export default CustomAthkarCard;

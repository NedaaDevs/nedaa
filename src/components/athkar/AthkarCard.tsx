import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Check, Minus } from "lucide-react-native";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Types
import { Athkar } from "@/types/athkar";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  athkar: Athkar;
  progress: {
    current: number;
    total: number;
    completed: boolean;
  };
};

const AthkarCard: FC<Props> = ({ athkar, progress }) => {
  const { t, i18n } = useTranslation();
  const { incrementCount, decrementCount } = useAthkarStore();

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const isRTL = i18n.dir() === "rtl";

  const { current: currentCount, total, completed: isCompleted } = progress;
  const progressPercentage = (currentCount / total) * 100;

  const handleIncrement = () => {
    hapticSelection();
    incrementCount(athkar.id);

    if (isCompleted) {
      hapticSuccess();
      return;
    }

    if (currentCount + 1 === total) {
      hapticSuccess();
    }
  };

  return (
    <Pressable onPress={handleIncrement} disabled={isCompleted}>
      <Box
        padding="$4"
        borderRadius="$6"
        position="relative"
        backgroundColor={isCompleted ? "$backgroundSuccess" : "$backgroundSecondary"}
        borderWidth={isCompleted ? 2 : 0}
        borderColor={isCompleted ? "$success" : "transparent"}>
        <VStack gap="$3">
          {/* Athkar Text */}
          <Text
            size="xl"
            textAlign="left"
            style={{ lineHeight: 28 }}
            color={isCompleted ? "$typographySecondary" : "$typography"}>
            {t(athkar.text)}
          </Text>

          {/* Progress Section */}
          <VStack gap="$2">
            {/* Counter with buttons */}
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$2" alignItems="center">
                {currentCount > 0 && (
                  <Button
                    size="xs"
                    variant="outline"
                    action="default"
                    accessibilityLabel={t("common.decrement")}
                    onPress={(e: any) => {
                      e.stopPropagation();
                      decrementCount(athkar.id);
                      hapticWarning();
                    }}
                    width={44}
                    height={44}
                    padding={0}
                    borderRadius={999}
                    backgroundColor={isCompleted ? "$backgroundMuted" : "transparent"}
                    borderColor={isCompleted ? "$outlineSecondary" : "$info"}>
                    <Icon as={Minus} color="$info" />
                  </Button>
                )}
              </HStack>
              {/* Count Display */}
              <Text
                size="md"
                textAlign="left"
                fontWeight="500"
                color={isCompleted ? "$typographyContrast" : "$typographySecondary"}>
                {isRTL
                  ? `${formatNumberToLocale(`${total}`)} / ${formatNumberToLocale(`${currentCount}`)}`
                  : `${formatNumberToLocale(`${currentCount}`)} / ${formatNumberToLocale(`${total}`)}`}
              </Text>
            </HStack>

            {/* Progress Bar */}
            <Progress value={progressPercentage} size="md" backgroundColor="$backgroundMuted">
              <ProgressFilledTrack
                backgroundColor={isCompleted ? "$typographyContrast" : "$primary"}
              />
            </Progress>
          </VStack>

          {isCompleted && (
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
        </VStack>
      </Box>
    </Pressable>
  );
};

export default AthkarCard;

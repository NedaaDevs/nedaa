import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

// Icons
import { Minus, Check } from "lucide-react-native";

// Stores
import { useMyAthkarStore } from "@/stores/my-athkar";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Types
import type { MyAthkarProgress } from "@/types/hisnMuslim";

type Props = {
  myAthkarId: number;
  arabicText: string;
  categoryTitle: string;
  progress: MyAthkarProgress;
  onPress: () => void;
  onLongPress?: () => void;
};

const MyAthkarCard: FC<Props> = ({
  myAthkarId,
  arabicText,
  categoryTitle,
  progress,
  onPress,
  onLongPress,
}) => {
  const { i18n } = useTranslation();
  const { incrementCount, decrementCount } = useMyAthkarStore();
  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const isRTL = i18n.dir() === "rtl";
  const { currentCount, totalCount, completed } = progress;
  const progressPercentage = (currentCount / totalCount) * 100;

  const handleIncrement = () => {
    if (completed) return;
    hapticSelection();
    incrementCount(myAthkarId);
    if (currentCount + 1 >= totalCount) {
      hapticSuccess();
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={`${categoryTitle}. ${arabicText.substring(0, 50)}`}
      accessibilityHint="Double tap to view full athkar">
      <Box
        padding="$4"
        borderRadius="$6"
        position="relative"
        backgroundColor={completed ? "$backgroundSuccess" : "$backgroundSecondary"}
        borderWidth={completed ? 2 : 0}
        borderColor={completed ? "$success" : "transparent"}>
        <VStack gap="$3">
          {/* Category Label */}
          <Text
            size="xs"
            color="$typographySecondary"
            numberOfLines={1}
            textAlign={isRTL ? "right" : "left"}>
            {categoryTitle}
          </Text>

          {/* Arabic Text — tap to increment */}
          <Pressable
            onPress={handleIncrement}
            disabled={completed}
            accessibilityRole="button"
            accessibilityLabel={
              completed ? "Completed" : `Tap to count. ${currentCount} of ${totalCount}`
            }>
            <Text
              size="xl"
              style={{ writingDirection: "rtl" }}
              textAlign="right"
              color={completed ? "$typographySecondary" : "$typography"}
              numberOfLines={3}>
              {arabicText}
            </Text>
          </Pressable>

          {/* Progress Section */}
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
                      decrementCount(myAthkarId);
                      hapticWarning();
                    }}
                    width={44}
                    height={44}
                    padding={0}
                    borderRadius={999}
                    backgroundColor={completed ? "$backgroundMuted" : "transparent"}
                    borderColor={completed ? "$outlineSecondary" : "$info"}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease count">
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
        </VStack>
      </Box>
    </Pressable>
  );
};

export default MyAthkarCard;

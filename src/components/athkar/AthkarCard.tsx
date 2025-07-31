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
  const { incrementCount, decrementCount, currentType } = useAthkarStore();

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
        className={`p-4 rounded-xl relative ${
          isCompleted
            ? "bg-accent-success dark:bg-accent-success border-2 border-success"
            : "bg-background-secondary dark:bg-background-tertiary"
        }`}>
        <VStack space="md">
          {/* Athkar Text */}
          <Text
            className={`text-base text-left leading-relaxed ${isCompleted ? " text-typography-secondary" : "text-typography"}`}>
            {t(athkar.text)}
          </Text>

          {/* Progress Section */}
          <VStack space="sm">
            {/* Counter with buttons */}
            <HStack className="justify-between items-center">
              <HStack space="sm" className="items-center">
                {currentCount > 0 && (
                  <Button
                    size="xs"
                    variant="outline"
                    onPress={(e) => {
                      e.stopPropagation();
                      decrementCount(athkar.id);
                      hapticWarning();
                    }}
                    className={`w-10 h-10 p-0 rounded-full ${isCompleted ? "bg-black/20 border border-primary/50" : "text-typography-info"}`}>
                    <Icon as={Minus} className="text-typography-info" />
                  </Button>
                )}
              </HStack>
              {/* Count Display */}
              <Text
                className={`text-base text-left font-medium ${
                  isCompleted ? "text-white" : "text-typography-secondary"
                }`}>
                {isRTL
                  ? `${formatNumberToLocale(`${total}`)} / ${formatNumberToLocale(`${currentCount}`)}`
                  : `${formatNumberToLocale(`${currentCount}`)} / ${formatNumberToLocale(`${total}`)}`}
              </Text>
            </HStack>

            {/* Progress Bar */}
            <Progress
              value={progressPercentage}
              className={`h-3 ${isCompleted ? "bg-white/40" : "bg-background-tertiary"}`}>
              <ProgressFilledTrack className={isCompleted ? "bg-white" : "bg-accent-primary"} />
            </Progress>
          </VStack>

          {isCompleted && (
            <Box className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-success items-center justify-center shadow-md">
              <Icon as={Check} className="" />
            </Box>
          )}
        </VStack>
      </Box>
    </Pressable>
  );
};

export default AthkarCard;

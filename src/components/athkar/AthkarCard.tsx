import { FC } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button, ButtonText } from "@/components/ui/button";

// Icons
import { Plus, Minus, Focus } from "lucide-react-native";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Types
import { Athkar } from "@/types/athkar";

// Utils
import { formatNumberToLocale } from "@/utils/number";

type Props = {
  athkar: Athkar;
  progress: {
    current: number;
    total: number;
    completed: boolean;
  };
  onFocusMode: () => void;
};

const AthkarCard: FC<Props> = ({ athkar, progress, onFocusMode }) => {
  const { t, i18n } = useTranslation();
  const { incrementCount, decrementCount } = useAthkarStore();

  const isRTL = i18n.dir() === "rtl";

  const { current: currentCount, total, completed: isCompleted } = progress;
  const progressPercentage = (currentCount / total) * 100;

  return (
    <Pressable onPress={() => incrementCount(athkar.id)} disabled={isCompleted}>
      <Box
        className={`p-4 rounded-xl relative ${
          isCompleted
            ? "bg-accent-success dark:bg-accent-success border-2 border-success"
            : "bg-background-secondary dark:bg-background-tertiary"
        }`}>
        <VStack space="md">
          {/* Title */}
          <Text
            className={`text-lg font-semibold ${isCompleted ? "text-white" : "text-typography"}`}>
            {t(athkar.title)}
          </Text>

          {/* Athkar Text */}
          <Text
            className={`text-base leading-relaxed ${isCompleted ? "text-white/90" : "text-typography"}`}
            style={{ textAlign: "right", writingDirection: "rtl" }}>
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
                    }}
                    className={`w-10 h-10 p-0 rounded-full ${isCompleted ? "bg-black/20 border border-black/30" : "bg-background-tertiary dark:bg-background"}`}>
                    <Minus
                      size={20}
                      className={isCompleted ? "text-white/70" : "text-typography-secondary"}
                    />
                  </Button>
                )}

                <Button
                  size="xs"
                  variant="outline"
                  onPress={(e) => {
                    e.stopPropagation();
                    incrementCount(athkar.id);
                  }}
                  className={`w-10 h-10 p-0 rounded-full ${isCompleted ? "bg-black/20 border border-black/30" : "bg-background-tertiary dark:bg-background"}`}
                  disabled={isCompleted}>
                  <Plus
                    size={20}
                    className={isCompleted ? "text-white/70" : "text-typography-secondary"}
                  />
                </Button>
              </HStack>

              {/* Count Display */}
              <Text
                className={`text-base font-medium ${
                  isCompleted ? "text-white" : "text-typography-secondary"
                }`}
                style={{
                  writingDirection: isRTL ? "rtl" : "ltr",
                  textAlign: isRTL ? "right" : "left",
                }}>
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

          {/* Focus Mode Button for each card */}
          {!isCompleted && (
            <Button
              size="sm"
              variant="solid"
              onPress={onFocusMode}
              className="mt-3 bg-accent-primary">
              <Focus size={16} className="mr-2" />
              <ButtonText className="text-sm">{t("athkar.enterFocusMode")}</ButtonText>
            </Button>
          )}

          {isCompleted && (
            <Box className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white items-center justify-center shadow-md">
              <Text className="text-accent-success text-2xl font-bold">✓</Text>
            </Box>
          )}
        </VStack>
      </Box>
    </Pressable>
  );
};

export default AthkarCard;

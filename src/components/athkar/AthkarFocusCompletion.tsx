import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { X } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Types
import { AthkarType } from "@/types/athkar";

type AthkarFocusCompletionProps = {
  currentType: Exclude<AthkarType, "all">;
  athkarCount: number;
  completionStyle: any;
};

export const AthkarFocusCompletion = ({
  currentType,
  athkarCount,
  completionStyle,
}: AthkarFocusCompletionProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleFinish = () => {
    router.back();
  };

  return (
    <GestureHandlerRootView className="flex-1">
      <Box className="flex-1 bg-background">
        {/* Header */}
        <Box className="absolute top-12 right-4 z-10">
          <Button
            size="md"
            variant="outline"
            onPress={handleFinish}
            className="w-12 h-12 p-0 rounded-full bg-background-secondary/80">
            <Icon size="md" className="text-typography" as={X} />
          </Button>
        </Box>

        <VStack className="flex-1 justify-center items-center px-8" space="2xl">
          {/* Completion Animation */}
          <Animated.View style={completionStyle} className="items-center">
            <VStack space="xl" className="items-center">
              {/* Success Icon */}
              <Box className="w-32 h-32 rounded-full bg-success/10 items-center justify-center">
                <Text className="text-6xl">🎉</Text>
              </Box>

              {/* Completion Message */}
              <VStack space="md" className="items-center">
                <Text className="text-2xl font-bold text-success text-center">
                  {t("athkar.focus.allCompleted", {
                    type: t(`athkar.${currentType}`),
                  })}
                </Text>
                <Text className="text-lg text-typography-secondary text-center">
                  {t("athkar.focus.mayAllahAccept")}
                </Text>
                <Text className="text-sm text-typography-tertiary text-center">
                  {currentType === ATHKAR_TYPE.MORNING
                    ? t("athkar.focus.seeYouEvening")
                    : t("athkar.focus.seeYouTomorrow")}
                </Text>
              </VStack>

              {/* Session Stats */}
              <Box className="bg-background-secondary dark:bg-background-tertiary p-6 rounded-xl w-full">
                <VStack space="md" className="items-center">
                  <Text className="text-typography-secondary font-medium">
                    {t("athkar.focus.sessionComplete")}
                  </Text>
                  <HStack space="xl" className="justify-center">
                    <VStack className="items-center" space="xs">
                      <Text className="text-3xl font-bold text-accent-info">
                        {formatNumberToLocale(`${athkarCount}`)}
                      </Text>
                      <Text className="text-xs text-typography-secondary">
                        {t("athkar.focus.athkarLabel")}
                      </Text>
                    </VStack>
                    <VStack className="items-center" space="xs">
                      <Text className="text-3xl font-bold text-success">
                        {formatNumberToLocale("100")}%
                      </Text>
                      <Text className="text-xs text-typography-secondary">
                        {t("athkar.focus.completeLabel")}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </Box>

              {/* Finish Button */}
              <Button
                size="lg"
                onPress={handleFinish}
                className="bg-success w-full justify-center items-center">
                <ButtonText className="text-white font-semibold text-lg text-center">
                  {t("athkar.focus.finish")}
                </ButtonText>
              </Button>
            </VStack>
          </Animated.View>
        </VStack>
      </Box>
    </GestureHandlerRootView>
  );
};

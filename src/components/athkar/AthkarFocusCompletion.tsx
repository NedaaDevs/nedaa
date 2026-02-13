import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Box flex={1} backgroundColor="$background">
        {/* Header */}
        <Box position="absolute" top={48} end={16} zIndex={10}>
          <Button
            size="md"
            variant="outline"
            action="default"
            onPress={handleFinish}
            accessibilityLabel={t("common.close")}
            width={48}
            height={48}
            padding={0}
            borderRadius={999}
            backgroundColor="$backgroundSecondary"
            opacity={0.8}>
            <Icon size="md" color="$typography" as={X} />
          </Button>
        </Box>

        <VStack
          flex={1}
          justifyContent="center"
          alignItems="center"
          paddingHorizontal="$8"
          gap="$7">
          {/* Completion Animation */}
          <Animated.View style={[completionStyle, { alignItems: "center" }]}>
            <VStack gap="$5" alignItems="center">
              {/* Success Icon */}
              <Box
                width={128}
                height={128}
                borderRadius={999}
                backgroundColor="$backgroundSuccess"
                alignItems="center"
                justifyContent="center"
                overflow="visible">
                <Text style={{ fontSize: 48, lineHeight: 56 }}>🎉</Text>
              </Box>

              {/* Completion Message */}
              <VStack gap="$3" alignItems="center">
                <Text size="2xl" bold color="$success" textAlign="center">
                  {t("athkar.focus.allCompleted", {
                    type: t(`athkar.${currentType}`),
                  })}
                </Text>
                <Text size="lg" color="$typographySecondary" textAlign="center">
                  {t("athkar.focus.mayAllahAccept")}
                </Text>
                <Text size="sm" color="$typographySecondary" textAlign="center">
                  {currentType === ATHKAR_TYPE.MORNING
                    ? t("athkar.focus.seeYouEvening")
                    : t("athkar.focus.seeYouTomorrow")}
                </Text>
              </VStack>

              {/* Session Stats */}
              <Box
                backgroundColor="$backgroundSecondary"
                padding="$6"
                borderRadius="$6"
                width="100%">
                <VStack gap="$3" alignItems="center">
                  <Text color="$typographySecondary" fontWeight="500">
                    {t("athkar.focus.sessionComplete")}
                  </Text>
                  <HStack gap="$5" justifyContent="center">
                    <VStack alignItems="center" gap="$1">
                      <Text size="3xl" bold color="$info">
                        {formatNumberToLocale(`${athkarCount}`)}
                      </Text>
                      <Text size="xs" color="$typographySecondary">
                        {t("athkar.focus.athkarLabel")}
                      </Text>
                    </VStack>
                    <VStack alignItems="center" gap="$1">
                      <Text size="3xl" bold color="$success">
                        {formatNumberToLocale("100")}%
                      </Text>
                      <Text size="xs" color="$typographySecondary">
                        {t("athkar.focus.completeLabel")}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </Box>

              {/* Finish Button */}
              <Button
                size="lg"
                action="positive"
                onPress={handleFinish}
                width="100%"
                justifyContent="center"
                alignItems="center">
                <Button.Text
                  color="$typographyContrast"
                  fontWeight="600"
                  size="lg"
                  textAlign="center"
                  width="100%">
                  {t("athkar.focus.finish")}
                </Button.Text>
              </Button>
            </VStack>
          </Animated.View>
        </VStack>
      </Box>
    </GestureHandlerRootView>
  );
};

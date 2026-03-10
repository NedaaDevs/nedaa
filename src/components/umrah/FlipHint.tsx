import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

const HINT_DISPLAY_MS = 3000;
const HINT_FADE_MS = 400;

const FlipHint = () => {
  const { t } = useTranslation();
  const { hasSeenFlipHint, markFlipHintSeen } = useUmrahGuideStore();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (hasSeenFlipHint) return;

    opacity.value = withDelay(
      HINT_DISPLAY_MS,
      withTiming(0, { duration: HINT_FADE_MS }, (finished) => {
        if (finished) runOnJS(markFlipHintSeen)();
      })
    );
  }, [hasSeenFlipHint, markFlipHintSeen, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (hasSeenFlipHint) return null;

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: HINT_FADE_MS }, (finished) => {
      if (finished) runOnJS(markFlipHintSeen)();
    });
  };

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: 8,
          left: 0,
          right: 0,
          alignItems: "center",
        },
        animatedStyle,
      ]}
      pointerEvents={hasSeenFlipHint ? "none" : "auto"}>
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.umrah.dismissHint")}
        accessibilityHint={t("umrah.flipHint")}
        style={{ minHeight: 44, justifyContent: "center" }}>
        <Box
          paddingHorizontal="$3"
          paddingVertical="$1.5"
          borderRadius={20}
          backgroundColor="$typography"
          opacity={0.85}>
          <Text size="xs" color="$background" fontWeight="600">
            {t("umrah.flipHint")}
          </Text>
        </Box>
      </Pressable>
    </Animated.View>
  );
};

export default FlipHint;

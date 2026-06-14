import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";

interface LineShimmerProps {
  screenWidth: number;
  lineHeight: number;
  quranTheme: QuranThemeType;
}

const LineShimmer = ({ screenWidth, lineHeight, quranTheme }: LineShimmerProps) => {
  const translateX = useSharedValue(-screenWidth);
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(screenWidth, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [screenWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        styles.container,
        { width: screenWidth, height: lineHeight, backgroundColor: themeColors.shimmerBase },
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={["transparent", themeColors.shimmerHighlight, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: screenWidth, height: lineHeight }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default LineShimmer;

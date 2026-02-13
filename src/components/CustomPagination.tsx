import { FC } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";

type PaginationProps = {
  data: any[];
  onPress: (index: number) => void;
  currentIndex: number;
  variant?: "dots" | "pills" | "slider" | "icons" | "lines";
};

const CustomPagination: FC<PaginationProps> = ({
  data,
  onPress,
  currentIndex,
  variant = "dots",
}) => {
  const { t } = useTranslation();

  const renderDots = () => (
    <Box paddingBottom="$5" paddingTop="$2">
      <Box flexDirection="row" gap="$2">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            minHeight={44}
            minWidth={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button">
            <Box
              height={8}
              borderRadius={999}
              width={currentIndex === index ? 24 : 8}
              backgroundColor={currentIndex === index ? "$accentPrimary" : "$outline"}
            />
          </Pressable>
        ))}
      </Box>
    </Box>
  );

  const renderPills = () => (
    <Box alignItems="center" backgroundColor="$backgroundSecondary">
      <Box
        flexDirection="row"
        backgroundColor="$backgroundMuted"
        borderRadius="$8"
        gap="$1"
        padding="$1">
        <Pressable
          onPress={() => onPress(0)}
          paddingHorizontal="$5"
          paddingVertical="$2"
          borderRadius="$7"
          minHeight={44}
          justifyContent="center"
          backgroundColor={currentIndex === 0 ? "$accentPrimary" : "transparent"}
          accessibilityRole="button">
          <Text
            size="sm"
            color={currentIndex === 0 ? "$typographyContrast" : "$accentPrimary"}
            fontWeight={currentIndex === 0 ? "600" : "400"}>
            {t("common.prayers")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onPress(1)}
          paddingHorizontal="$5"
          paddingVertical="$2"
          borderRadius="$7"
          minHeight={44}
          justifyContent="center"
          backgroundColor={currentIndex === 1 ? "$accentPrimary" : "transparent"}
          accessibilityRole="button">
          <Text
            size="sm"
            color={currentIndex === 1 ? "$typographyContrast" : "$accentPrimary"}
            fontWeight={currentIndex === 1 ? "600" : "400"}>
            {t("common.otherTimings")}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );

  const renderSlider = () => (
    <Box paddingBottom="$5" paddingTop="$2" alignItems="center">
      <View
        style={{
          flexDirection: "row",
          height: 4,
          width: 120,
          backgroundColor: "transparent",
          borderRadius: 2,
          overflow: "hidden",
        }}>
        <Animated.View
          style={{
            width: "50%",
            height: "100%",
            borderRadius: 2,
            backgroundColor: "transparent",
            transform: [
              {
                translateX: currentIndex === 0 ? 0 : 60,
              },
            ],
          }}
        />
      </View>
      <Box flexDirection="row" marginTop="$2" gap="$6">
        <Pressable
          onPress={() => onPress(0)}
          minHeight={44}
          justifyContent="center"
          accessibilityRole="button">
          <Text
            size="xs"
            color={currentIndex === 0 ? "$accentPrimary" : "$typographySecondary"}
            fontWeight={currentIndex === 0 ? "600" : "400"}>
            {t("prayerTimes.title")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onPress(1)}
          minHeight={44}
          justifyContent="center"
          accessibilityRole="button">
          <Text
            size="xs"
            color={currentIndex === 1 ? "$accentPrimary" : "$typographySecondary"}
            fontWeight={currentIndex === 1 ? "600" : "400"}>
            {t("otherTimings.title")}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );

  const renderIcons = () => (
    <Box paddingBottom="$5" paddingTop="$2" alignItems="center">
      <Box flexDirection="row" gap="$4">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            minHeight={44}
            minWidth={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button">
            <Box
              height={12}
              borderRadius="$2"
              width={currentIndex === index ? 32 : 12}
              backgroundColor={currentIndex === index ? "$accentPrimary" : "$outline"}
            />
          </Pressable>
        ))}
      </Box>
    </Box>
  );

  const renderLines = () => (
    <Box paddingBottom="$5" paddingTop="$2" alignItems="center">
      <Box flexDirection="row" gap="$3">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            minHeight={44}
            minWidth={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button">
            <Box
              width={24}
              height={2}
              backgroundColor={currentIndex === index ? "$accentPrimary" : "$outline"}
              borderRadius={currentIndex === index ? 2 : 0}
            />
          </Pressable>
        ))}
      </Box>
    </Box>
  );

  const variants = {
    dots: renderDots,
    pills: renderPills,
    slider: renderSlider,
    icons: renderIcons,
    lines: renderLines,
  };

  return variants[variant]?.() || renderDots();
};

export default CustomPagination;

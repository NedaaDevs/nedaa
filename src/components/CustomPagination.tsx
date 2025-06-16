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
    <Box className="pb-5 pt-2.5">
      <View className="flex-row gap-2">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            className={`h-2 rounded-full ${
              currentIndex === index ? "w-6 bg-accent-primary" : "w-2 bg-outline"
            }`}
          />
        ))}
      </View>
    </Box>
  );

  const renderPills = () => (
    <Box className="items-center bg-background-secondary">
      <View className="flex-row bg-background-muted rounded-3xl gap-1 p-1">
        <Pressable
          onPress={() => onPress(0)}
          className={`px-5 py-2 rounded-2xl ${
            currentIndex === 0 ? "bg-accent-primary" : "bg-transparent"
          }`}>
          <Text
            className={`text-sm ${
              currentIndex === 0
                ? "text-typography-contrast font-semibold"
                : "text-accent-primary font-normal"
            }`}>
            {t("common.prayers")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onPress(1)}
          className={`px-5 py-2 rounded-2xl ${
            currentIndex === 1 ? "bg-accent-primary" : "bg-transparent"
          }`}>
          <Text
            className={`text-sm ${
              currentIndex === 1
                ? "text-typography-contrast font-semibold"
                : "text-accent-primary font-normal"
            }`}>
            {t("common.otherTimings")}
          </Text>
        </Pressable>
      </View>
    </Box>
  );

  const renderSlider = () => (
    <Box className="pb-5 pt-2.5 items-center">
      <View className="flex-row h-1 w-30 bg-outline rounded-sm overflow-hidden">
        <Animated.View
          style={{
            width: "50%",
            height: "100%",
            borderRadius: 2,
            transform: [
              {
                translateX: currentIndex === 0 ? 0 : 60,
              },
            ],
          }}
          className="bg-accent-primary"
        />
      </View>
      <View className="flex-row mt-2 gap-15">
        <Pressable onPress={() => onPress(0)}>
          <Text
            className={`text-xs ${
              currentIndex === 0
                ? "text-accent-primary font-semibold"
                : "text-typography-secondary font-normal"
            }`}>
            {t("prayerTimes.title")}
          </Text>
        </Pressable>
        <Pressable onPress={() => onPress(1)}>
          <Text
            className={`text-xs ${
              currentIndex === 1
                ? "text-accent-primary font-semibold"
                : "text-typography-secondary font-normal"
            }`}>
            {t("otherTimings.title")}
          </Text>
        </Pressable>
      </View>
    </Box>
  );

  const renderIcons = () => (
    <Box className="pb-5 pt-2.5 items-center">
      <View className="flex-row gap-4">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            className={`h-3 rounded-md ${
              currentIndex === index ? "w-8 bg-accent-primary" : "w-3 bg-outline"
            }`}
          />
        ))}
      </View>
    </Box>
  );

  const renderLines = () => (
    <Box className="pb-5 pt-2.5 items-center">
      <View className="flex-row gap-3">
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => onPress(index)}
            className={`w-6 h-0.5 ${
              currentIndex === index ? "bg-accent-primary rounded-sm" : "bg-outline"
            }`}
          />
        ))}
      </View>
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

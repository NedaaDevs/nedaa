import { FC } from "react";
import { useTranslation } from "react-i18next";

import { Pagination } from "react-native-reanimated-carousel";
import { TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";

type PaginationProps = {
  progress: any;
  data: any[];
  onPress: (index: number) => void;
  isDarkMode: boolean;
  currentIndex: number;
  variant?: "dots" | "pills" | "slider" | "icons" | "lines";
};

const CustomPagination: FC<PaginationProps> = ({
  progress,
  data,
  onPress,
  isDarkMode,
  currentIndex,
  variant = "dots",
}) => {
  const { t } = useTranslation();

  const activeColor = isDarkMode ? "#e5cb87" : "#1e3c5a";
  const inactiveColor = isDarkMode ? "#4a4a4a" : "#d0d0d0";
  const bgColor = isDarkMode ? "#2a2a2a" : "#f5f5f5";

  const renderDots = () => (
    <Box style={{ paddingBottom: 20, paddingTop: 10 }}>
      <Pagination.Basic
        progress={progress}
        data={data}
        dotStyle={{
          backgroundColor: inactiveColor,
          borderRadius: 50,
          width: 8,
          height: 8,
        }}
        activeDotStyle={{
          backgroundColor: activeColor,
          width: 24,
          height: 8,
          borderRadius: 4,
        }}
        containerStyle={{ gap: 8 }}
        onPress={onPress}
      />
    </Box>
  );

  const renderPills = () => (
    <Box
      style={{
        alignItems: "center",
        backgroundColor: isDarkMode ? "#1e3c5a" : "#ffffff",
      }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: bgColor,
          borderRadius: 25,
          gap: 4,
          padding: 4,
        }}>
        <TouchableOpacity
          onPress={() => onPress(0)}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: currentIndex === 0 ? activeColor : "transparent",
          }}>
          <Text
            style={{
              color: currentIndex === 0 ? "#fff" : activeColor,
              fontWeight: currentIndex === 0 ? "600" : "400",
              fontSize: 14,
            }}>
            {t("common.prayers")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onPress(1)}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: currentIndex === 1 ? activeColor : "transparent",
          }}>
          <Text
            style={{
              color: currentIndex === 1 ? "#fff" : activeColor,
              fontWeight: currentIndex === 1 ? "600" : "400",
              fontSize: 14,
            }}>
            {t("common.otherTimings")}
          </Text>
        </TouchableOpacity>
      </View>
    </Box>
  );

  const renderSlider = () => (
    <Box style={{ paddingBottom: 20, paddingTop: 10, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          height: 4,
          width: 120,
          backgroundColor: inactiveColor,
          borderRadius: 2,
          overflow: "hidden",
        }}>
        <Animated.View
          style={{
            width: "50%",
            height: "100%",
            backgroundColor: activeColor,
            borderRadius: 2,
            transform: [
              {
                translateX: currentIndex === 0 ? 0 : 60,
              },
            ],
          }}
        />
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: 60 }}>
        <TouchableOpacity onPress={() => onPress(0)}>
          <Text
            style={{
              color: currentIndex === 0 ? activeColor : inactiveColor,
              fontSize: 12,
              fontWeight: currentIndex === 0 ? "600" : "400",
            }}>
            {t("prayerTimes.title")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onPress(1)}>
          <Text
            style={{
              color: currentIndex === 1 ? activeColor : inactiveColor,
              fontSize: 12,
              fontWeight: currentIndex === 1 ? "600" : "400",
            }}>
            {t("otherTimings.title")}
          </Text>
        </TouchableOpacity>
      </View>
    </Box>
  );

  const renderIcons = () => (
    <Box style={{ paddingBottom: 20, paddingTop: 10, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {data.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onPress(index)}
            style={{
              width: currentIndex === index ? 32 : 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: currentIndex === index ? activeColor : inactiveColor,
            }}
          />
        ))}
      </View>
    </Box>
  );

  const renderLines = () => (
    <Box style={{ paddingBottom: 20, paddingTop: 10, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {data.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onPress(index)}
            style={{
              width: 24,
              height: 3,
              backgroundColor: currentIndex === index ? activeColor : inactiveColor,
              borderRadius: currentIndex === index ? 1.5 : 0,
            }}
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

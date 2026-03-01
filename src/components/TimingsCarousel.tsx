import * as React from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Divider } from "@/components/ui/divider";
import PrayerTimes from "@/components/PrayerTimesList";
import OtherTimes from "@/components/OtherTimingsList";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { AppMode } from "@/enums/app";

const tabs = [
  { key: "prayer-times", labelKey: "prayerTimes.title" },
  { key: "other-timings", labelKey: "otherTimings.title" },
];

type Props = {
  mode: AppMode;
};

const TimingsCarousel = (props: Props) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const selectionHaptic = useHaptic("selection");
  const { t } = useTranslation();

  const handleTabPress = async (index: number) => {
    if (index === currentIndex) return;
    await selectionHaptic();
    setCurrentIndex(index);
  };

  return (
    <Box flex={1} flexDirection="column">
      {/* Underline Tabs */}
      <Box flexDirection="row" justifyContent="center" gap="$6">
        {tabs.map((tab, index) => {
          const isActive = currentIndex === index;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(index)}
              paddingVertical="$2"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <Text
                size="md"
                fontWeight={isActive ? "700" : "400"}
                color={isActive ? "$typography" : "$typographySecondary"}>
                {t(tab.labelKey)}
              </Text>
              {isActive && (
                <Box
                  height={2}
                  marginTop="$1"
                  borderRadius={999}
                  backgroundColor="$accentPrimary"
                />
              )}
            </Pressable>
          );
        })}
      </Box>

      <Divider marginTop="$1" />

      <Box flex={1}>{currentIndex === 0 ? <PrayerTimes /> : <OtherTimes />}</Box>
    </Box>
  );
};

export default TimingsCarousel;

import { useState, useCallback } from "react";
import { Platform, ScrollView, Alert, LayoutAnimation } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";

// Icons
import {
  Plus,
  Clock,
  BookOpen,
  RotateCcw,
  Layers,
  Info,
  BatteryWarning,
  CheckCircle,
  ChevronDown,
} from "lucide-react-native";

// Widget module
import {
  isPinningSupported,
  pinWidget,
  isBatteryOptimizationDisabled,
  requestDisableBatteryOptimization,
  type WidgetType,
} from "expo-widgets";

type WidgetItem = {
  type: WidgetType;
  nameKey: string;
  descKey: string;
  icon: typeof Clock;
  size: string;
};

const WIDGETS: WidgetItem[] = [
  {
    type: "prayer_small",
    nameKey: "settings.widgets.prayerSmall",
    descKey: "settings.widgets.prayerSmallDesc",
    icon: Clock,
    size: "2×2",
  },
  {
    type: "prayer_medium",
    nameKey: "settings.widgets.prayerMedium",
    descKey: "settings.widgets.prayerMediumDesc",
    icon: Clock,
    size: "4×2",
  },
  {
    type: "prayer_large",
    nameKey: "settings.widgets.prayerLarge",
    descKey: "settings.widgets.prayerLargeDesc",
    icon: Clock,
    size: "4×4",
  },
  {
    type: "athkar",
    nameKey: "settings.widgets.athkar",
    descKey: "settings.widgets.athkarDesc",
    icon: BookOpen,
    size: "2×2",
  },
  {
    type: "athkar_medium",
    nameKey: "settings.widgets.athkarMedium",
    descKey: "settings.widgets.athkarMediumDesc",
    icon: BookOpen,
    size: "4×2",
  },
  {
    type: "qada",
    nameKey: "settings.widgets.qada",
    descKey: "settings.widgets.qadaDesc",
    icon: RotateCcw,
    size: "2×2",
  },
  {
    type: "qada_medium",
    nameKey: "settings.widgets.qadaMedium",
    descKey: "settings.widgets.qadaMediumDesc",
    icon: RotateCcw,
    size: "4×2",
  },
  {
    type: "prayer_athkar",
    nameKey: "settings.widgets.prayerAthkar",
    descKey: "settings.widgets.prayerAthkarDesc",
    icon: Layers,
    size: "4×2",
  },
];

const WidgetCard = ({
  widget,
  canPin,
  t,
}: {
  widget: WidgetItem;
  canPin: boolean;
  t: (key: string) => string;
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const handlePin = async () => {
    const success = await pinWidget(widget.type);
    if (!success) {
      Alert.alert(t("settings.widgets.notSupported"));
    }
  };

  return (
    <Pressable
      onPress={toggleExpand}
      className="rounded-2xl bg-background-secondary border border-outline overflow-hidden">
      {/* Header row */}
      <HStack className="p-4 items-center">
        <Box className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
          <Icon as={widget.icon} size="sm" className="text-primary" />
        </Box>
        <VStack className="flex-1 ms-3">
          <Text className="text-base font-semibold text-typography text-left">
            {t(widget.nameKey)}
          </Text>
          <Text className="text-xs text-typography-secondary text-left">{widget.size}</Text>
        </VStack>
        <Icon
          as={ChevronDown}
          size="sm"
          className={`text-typography-secondary ${expanded ? "rotate-180" : ""}`}
        />
      </HStack>

      {/* Expanded content */}
      {expanded && (
        <VStack className="px-4 pb-4" space="md">
          <Text className="text-sm text-typography-secondary text-left">{t(widget.descKey)}</Text>
          <Button size="md" className="bg-primary w-full" onPress={handlePin} disabled={!canPin}>
            <Icon as={Plus} size="sm" className="text-typography-contrast" />
            <ButtonText className="text-typography-contrast font-medium">
              {t("settings.widgets.addToHomeScreen")}
            </ButtonText>
          </Button>
        </VStack>
      )}
    </Pressable>
  );
};

const WidgetSettings = () => {
  const { t } = useTranslation();
  const canPin = Platform.OS === "android" && isPinningSupported();
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") {
        setBatteryOptDisabled(isBatteryOptimizationDisabled());
      }
    }, [])
  );

  const handleBatteryOptimization = () => {
    requestDisableBatteryOptimization();
  };

  return (
    <Background>
      <TopBar title="settings.widgets.title" backOnClick />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack space="md" className="px-4 pt-6 pb-4">
          {/* Description */}
          <Text className="text-sm text-typography-secondary text-left">
            {t("settings.widgets.description")}
          </Text>

          {/* iOS info note */}
          {Platform.OS === "ios" && (
            <HStack
              space="md"
              className="p-4 rounded-2xl bg-background-secondary border border-outline items-start">
              <Icon as={Info} size="sm" className="text-primary mt-0.5" />
              <Text className="text-sm text-typography flex-1 text-left">
                {t("settings.widgets.iosNote")}
              </Text>
            </HStack>
          )}

          {/* Battery optimization banner (Android only) */}
          {Platform.OS === "android" && !batteryOptDisabled && (
            <Pressable
              onPress={handleBatteryOptimization}
              className="p-4 rounded-2xl border border-warning bg-warning/5">
              <HStack space="md" className="items-start">
                <Icon as={BatteryWarning} size="md" className="text-warning mt-0.5" />
                <VStack className="flex-1" space="xs">
                  <Text className="text-sm font-semibold text-typography text-left">
                    {t("settings.widgets.batteryOptTitle")}
                  </Text>
                  <Text className="text-xs text-typography-secondary text-left">
                    {t("settings.widgets.batteryOptDesc")}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          )}

          {Platform.OS === "android" && batteryOptDisabled && (
            <HStack
              space="sm"
              className="px-4 py-3 rounded-2xl bg-background-secondary border border-outline items-center">
              <Icon as={CheckCircle} size="sm" className="text-success" />
              <Text className="text-xs text-typography-secondary text-left flex-1">
                {t("settings.widgets.batteryOptDone")}
              </Text>
            </HStack>
          )}

          {/* Android widget list */}
          {Platform.OS === "android" && (
            <VStack space="sm">
              {WIDGETS.map((widget) => (
                <WidgetCard key={widget.type} widget={widget} canPin={canPin} t={t} />
              ))}

              {!canPin && (
                <Text className="text-xs text-typography-secondary text-center mt-2">
                  {t("settings.widgets.notSupported")}
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default WidgetSettings;

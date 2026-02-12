import { useState, useCallback } from "react";
import { Platform, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
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
};

const WIDGETS: WidgetItem[] = [
  {
    type: "prayer_small",
    nameKey: "settings.widgets.prayerSmall",
    descKey: "settings.widgets.prayerSmallDesc",
    icon: Clock,
  },
  {
    type: "prayer_medium",
    nameKey: "settings.widgets.prayerMedium",
    descKey: "settings.widgets.prayerMediumDesc",
    icon: Clock,
  },
  {
    type: "prayer_large",
    nameKey: "settings.widgets.prayerLarge",
    descKey: "settings.widgets.prayerLargeDesc",
    icon: Clock,
  },
  {
    type: "athkar",
    nameKey: "settings.widgets.athkar",
    descKey: "settings.widgets.athkarDesc",
    icon: BookOpen,
  },
  {
    type: "athkar_medium",
    nameKey: "settings.widgets.athkarMedium",
    descKey: "settings.widgets.athkarMediumDesc",
    icon: BookOpen,
  },
  {
    type: "qada",
    nameKey: "settings.widgets.qada",
    descKey: "settings.widgets.qadaDesc",
    icon: RotateCcw,
  },
  {
    type: "qada_medium",
    nameKey: "settings.widgets.qadaMedium",
    descKey: "settings.widgets.qadaMediumDesc",
    icon: RotateCcw,
  },
  {
    type: "prayer_athkar",
    nameKey: "settings.widgets.prayerAthkar",
    descKey: "settings.widgets.prayerAthkarDesc",
    icon: Layers,
  },
];

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

  const handlePinWidget = (widget: WidgetItem) => {
    const success = pinWidget(widget.type);
    if (!success) {
      Alert.alert(t("settings.widgets.notSupported"));
    }
  };

  const handleBatteryOptimization = () => {
    requestDisableBatteryOptimization();
  };

  return (
    <Background>
      <TopBar title="settings.widgets.title" backOnClick />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack space="lg" className="px-4 pt-6 pb-4">
          {/* Description */}
          <Text className="text-sm text-typography-secondary text-left">
            {t("settings.widgets.description")}
          </Text>

          {/* iOS info note */}
          {Platform.OS === "ios" && (
            <HStack
              space="md"
              className="p-4 rounded-xl bg-background-secondary border border-outline items-start">
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
              className="p-4 rounded-xl bg-background-warning/10 border border-warning">
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
              className="px-4 py-3 rounded-xl bg-background-secondary border border-outline items-center">
              <Icon as={CheckCircle} size="sm" className="text-success" />
              <Text className="text-xs text-typography-secondary text-left">
                {t("settings.widgets.batteryOptDone")}
              </Text>
            </HStack>
          )}

          {/* Android widget list */}
          {Platform.OS === "android" && (
            <VStack space="sm">
              {WIDGETS.map((widget) => (
                <Pressable
                  key={widget.type}
                  onPress={() => canPin && handlePinWidget(widget)}
                  className="p-4 rounded-xl bg-background-secondary border border-outline">
                  <HStack className="items-center justify-between">
                    <HStack space="md" className="items-center flex-1">
                      <Icon as={widget.icon} size="md" className="text-primary" />
                      <VStack className="flex-1">
                        <Text className="text-base font-medium text-typography text-left">
                          {t(widget.nameKey)}
                        </Text>
                        <Text className="text-xs text-typography-secondary text-left mt-0.5">
                          {t(widget.descKey)}
                        </Text>
                      </VStack>
                    </HStack>
                    <Button
                      size="sm"
                      className="bg-primary"
                      onPress={() => handlePinWidget(widget)}
                      disabled={!canPin}>
                      <Icon as={Plus} size="sm" className="text-typography-contrast" />
                      <ButtonText className="text-typography-contrast text-sm">
                        {t("settings.widgets.addToHomeScreen")}
                      </ButtonText>
                    </Button>
                  </HStack>
                </Pressable>
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

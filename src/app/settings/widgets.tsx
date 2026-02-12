import { Platform, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Plus, Clock, BookOpen, RotateCcw, Layers, Info } from "lucide-react-native";

// Widget module
import { isPinningSupported, pinWidget, type WidgetType } from "expo-widgets";

type WidgetItem = {
  type: WidgetType;
  nameKey: string;
  icon: typeof Clock;
};

const WIDGETS: WidgetItem[] = [
  { type: "prayer_small", nameKey: "settings.widgets.prayerSmall", icon: Clock },
  { type: "prayer_medium", nameKey: "settings.widgets.prayerMedium", icon: Clock },
  { type: "prayer_large", nameKey: "settings.widgets.prayerLarge", icon: Clock },
  { type: "athkar", nameKey: "settings.widgets.athkar", icon: BookOpen },
  { type: "athkar_medium", nameKey: "settings.widgets.athkarMedium", icon: BookOpen },
  { type: "qada", nameKey: "settings.widgets.qada", icon: RotateCcw },
  { type: "qada_medium", nameKey: "settings.widgets.qadaMedium", icon: RotateCcw },
  { type: "prayer_athkar", nameKey: "settings.widgets.prayerAthkar", icon: Layers },
];

const WidgetSettings = () => {
  const { t } = useTranslation();
  const canPin = Platform.OS === "android" && isPinningSupported();

  const handlePinWidget = (widget: WidgetItem) => {
    const success = pinWidget(widget.type);
    if (!success) {
      Alert.alert(t("settings.widgets.notSupported"));
    }
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

          {/* Android widget list */}
          {Platform.OS === "android" && (
            <VStack space="sm">
              {WIDGETS.map((widget) => (
                <HStack
                  key={widget.type}
                  className="p-4 rounded-xl bg-background-secondary border border-outline items-center justify-between">
                  <HStack space="md" className="items-center flex-1">
                    <Icon as={widget.icon} size="md" className="text-primary" />
                    <Text className="text-base font-medium text-typography text-left">
                      {t(widget.nameKey)}
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary"
                    onPress={() => handlePinWidget(widget)}
                    disabled={!canPin}>
                    <Icon as={Plus} size="sm" className="text-primary" />
                    <ButtonText className="text-primary text-sm">
                      {t("settings.widgets.addToHomeScreen")}
                    </ButtonText>
                  </Button>
                </HStack>
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

import { useState, useCallback, useEffect, useRef } from "react";
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useToastStore } from "@/stores/toast";

import { refreshWidgets, CONFIRM_TIMEOUT_MS } from "@/services/widgetRefresh";
import {
  getPlacedWidgetCount,
  getWidgetLastRenderedAt,
  isWidgetRefreshAvailable,
  triggerWidgetReload,
} from "@/services/widgetBridge";

import type { WidgetRefreshResult } from "@/services/widgetRefresh";

// Icons
import {
  Plus,
  Clock,
  BookOpen,
  RotateCcw,
  Layers,
  Info,
  BatteryWarning,
  CircleCheck,
  ChevronDown,
  CalendarDays,
  Moon,
  CalendarRange,
} from "lucide-react-native";

// Widget module
import {
  isPinningSupported,
  pinWidget,
  isBatteryOptimizationDisabled,
  requestDisableBatteryOptimization,
  type WidgetType,
} from "expo-widgets";
import { PlatformType } from "@/enums/app";

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
  {
    type: "important_days",
    nameKey: "settings.widgets.importantDays",
    descKey: "settings.widgets.importantDaysDesc",
    icon: CalendarDays,
    size: "2×2",
  },
  {
    type: "all_prayers",
    nameKey: "settings.widgets.allPrayers",
    descKey: "settings.widgets.allPrayersDesc",
    icon: Clock,
    size: "4×2",
  },
  {
    type: "suhoor_iftar",
    nameKey: "settings.widgets.suhoorIftar",
    descKey: "settings.widgets.suhoorIftarDesc",
    icon: Moon,
    size: "2×2",
  },
  {
    type: "hijri_date",
    nameKey: "settings.widgets.hijriDate",
    descKey: "settings.widgets.hijriDateDesc",
    icon: CalendarRange,
    size: "2×1",
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
    try {
      const success = await pinWidget(widget.type);
      if (!success) {
        Alert.alert(t("settings.widgets.notSupported"));
      }
    } catch (error) {
      Alert.alert("Error", String(error));
    }
  };

  return (
    <Card variant="grouped" borderRadius="$7" borderWidth={1} borderColor="$outline">
      {/* Header row - tappable */}
      <Pressable
        onPress={toggleExpand}
        padding="$4"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(widget.nameKey)}>
        <HStack alignItems="center">
          <Box
            width={40}
            height={40}
            borderRadius="$6"
            backgroundColor="$primarySubtle"
            alignItems="center"
            justifyContent="center">
            <Icon as={widget.icon} size="sm" color="$primary" />
          </Box>
          <VStack flex={1} marginStart="$3">
            <Text size="lg" fontWeight="600">
              {t(widget.nameKey)}
            </Text>
            <Text size="xs" color="$typographySecondary">
              {widget.size}
            </Text>
          </VStack>
          <Icon
            as={ChevronDown}
            size="sm"
            color="$typographySecondary"
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </HStack>
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <VStack paddingHorizontal="$4" paddingBottom="$4" gap="$3">
          <Text size="sm" color="$typographySecondary">
            {t(widget.descKey)}
          </Text>
          <Button size="md" width="100%" onPress={handlePin} disabled={!canPin}>
            <Icon as={Plus} size="sm" color="$typographyContrast" />
            <Button.Text fontWeight="500">{t("settings.widgets.addToHomeScreen")}</Button.Text>
          </Button>
        </VStack>
      )}
    </Card>
  );
};

const REFRESH_TOASTS = {
  confirmed: { key: "settings.widgets.refreshConfirmed", type: "success" },
  pending: { key: "settings.widgets.refreshPending", type: "info" },
  "none-placed": { key: "settings.widgets.refreshNonePlaced", type: "info" },
  unavailable: { key: "settings.widgets.refreshFailed", type: "error" },
} as const satisfies Record<WidgetRefreshResult, { key: string; type: string }>;

const WidgetSettings = () => {
  const { t } = useTranslation();
  let canPin = false;
  try {
    canPin = Platform.OS === PlatformType.ANDROID && isPinningSupported();
  } catch {
    canPin = false;
  }
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(true);
  // True only while the user's grant is pending (dialog open), so returning to
  // the app can confirm success with a toast rather than a silent card swap.
  const awaitingBatteryGrant = useRef(false);
  const { becameActiveAt } = useAppVisibility();
  const showToast = useToastStore((s) => s.showToast);

  // Re-read on navigation focus AND every foreground return — the battery
  // dialog is a separate system Activity, so RN navigation focus never fires
  // when the user comes back from it; only the AppState 'active' transition does.
  const refreshBatteryState = useCallback(() => {
    if (Platform.OS !== PlatformType.ANDROID) return;
    const disabled = isBatteryOptimizationDisabled();
    setBatteryOptDisabled(disabled);
    if (disabled && awaitingBatteryGrant.current) {
      awaitingBatteryGrant.current = false;
      showToast(t("settings.widgets.batteryOptEnabled"), "success");
    }
  }, [showToast, t]);

  useFocusEffect(refreshBatteryState);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state from a native battery query on foreground return
    refreshBatteryState();
  }, [becameActiveAt, refreshBatteryState]);

  const handleBatteryOptimization = () => {
    awaitingBatteryGrant.current = true;
    requestDisableBatteryOptimization();
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    // Outlives the poll window so the outcome replaces it rather than following a
    // gap of silence — the pending path runs slightly past the deadline itself.
    showToast(t("settings.widgets.refreshStarted"), "muted", undefined, CONFIRM_TIMEOUT_MS + 2000);
    try {
      const result = await refreshWidgets({
        isReloadAvailable: isWidgetRefreshAvailable,
        getPlacedWidgetCount,
        getLastRenderedAt: getWidgetLastRenderedAt,
        reload: triggerWidgetReload,
        now: Date.now,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
      const toast = REFRESH_TOASTS[result];
      showToast(t(toast.key), toast.type);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, showToast, t]);

  return (
    <Background>
      <TopBar title="settings.widgets.title" backOnClick />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack gap="$3" paddingHorizontal="$4" paddingTop="$6" paddingBottom="$4">
          {/* Description */}
          <Text size="sm" color="$typographySecondary">
            {t("settings.widgets.description")}
          </Text>

          {/* iOS info note */}
          {Platform.OS === PlatformType.IOS && (
            <Card
              flexDirection="row"
              gap="$3"
              borderRadius="$7"
              borderWidth={1}
              borderColor="$outline"
              alignItems="flex-start">
              <Icon as={Info} size="sm" color="$primary" style={{ marginTop: 2 }} />
              <Text size="sm" flex={1}>
                {t("settings.widgets.iosNote")}
              </Text>
            </Card>
          )}

          {/* Manual escape hatch: rebuild every widget timeline from current data. */}
          <Card.Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            borderRadius="$7"
            borderWidth={1}
            borderColor="$outline"
            accessibilityRole="button"
            accessibilityState={{ disabled: refreshing }}
            accessibilityLabel={t("settings.widgets.refreshNow")}>
            <HStack gap="$3" alignItems="center">
              {refreshing ? (
                <Spinner size="small" color="$primary" />
              ) : (
                <Icon as={RotateCcw} size="sm" color="$primary" />
              )}
              <VStack flex={1} gap="$0.5">
                <Text size="sm" fontWeight="600">
                  {t("settings.widgets.refreshNow")}
                </Text>
                <Text size="xs" color="$typographySecondary">
                  {t("settings.widgets.refreshNowDesc")}
                </Text>
              </VStack>
            </HStack>
          </Card.Pressable>

          {/* Battery optimization banner (Android only) */}
          {Platform.OS === PlatformType.ANDROID && !batteryOptDisabled && (
            <Pressable
              onPress={handleBatteryOptimization}
              padding="$4"
              borderRadius="$7"
              borderWidth={1}
              borderColor="$warning"
              backgroundColor="$warningSubtle"
              accessibilityRole="button"
              accessibilityLabel={t("settings.widgets.batteryOptTitle")}>
              <HStack gap="$3" alignItems="flex-start">
                <Icon as={BatteryWarning} size="md" color="$warning" style={{ marginTop: 2 }} />
                <VStack flex={1} gap="$1">
                  <Text size="sm" fontWeight="600">
                    {t("settings.widgets.batteryOptTitle")}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("settings.widgets.batteryOptDesc")}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          )}

          {Platform.OS === PlatformType.ANDROID && batteryOptDisabled && (
            <Card
              flexDirection="row"
              gap="$2"
              paddingHorizontal="$4"
              paddingVertical="$3"
              borderRadius="$7"
              borderWidth={1}
              borderColor="$outline"
              alignItems="center">
              <Icon as={CircleCheck} size="sm" color="$success" />
              <Text size="xs" color="$typographySecondary" flex={1}>
                {t("settings.widgets.batteryOptDone")}
              </Text>
            </Card>
          )}

          {/* Android widget list */}
          {Platform.OS === PlatformType.ANDROID && (
            <VStack gap="$2">
              {WIDGETS.map((widget) => (
                <WidgetCard key={widget.type} widget={widget} canPin={canPin} t={t} />
              ))}

              {!canPin && (
                <Text size="xs" color="$typographySecondary" textAlign="center" marginTop="$2">
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

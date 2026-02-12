import { useTranslation } from "react-i18next";
import { ScrollView, Platform, Linking } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import * as Application from "expo-application";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import TopBar from "@/components/TopBar";

import {
  ChevronRight,
  Sun,
  Calendar,
  Bell,
  Clock,
  Maximize,
  BatteryCharging,
} from "lucide-react-native";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useRTL } from "@/contexts/RTLContext";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";

import {
  isAlarmKitAvailable,
  getAuthorizationStatus,
  requestAuthorization,
  canScheduleExactAlarms,
  requestExactAlarmPermission,
  canUseFullScreenIntent,
  requestFullScreenIntentPermission,
  isBatteryOptimizationExempt,
  requestBatteryOptimizationExemption,
} from "expo-alarm";

import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";
import { PermissionStatus } from "expo-notifications";

import { PlatformType } from "@/enums/app";

interface PermissionItem {
  id: string;
  icon: typeof Bell;
  titleKey: string;
  descriptionKey: string;
  granted: boolean;
  canRequestInApp: boolean;
  onRequest: () => Promise<void> | void;
}

const openAppSettings = () => {
  if (Platform.OS === PlatformType.IOS) {
    Linking.openURL("app-settings:");
  } else {
    Linking.openSettings();
  }
};

const openNotificationSettings = () => {
  if (Platform.OS === PlatformType.ANDROID) {
    Linking.sendIntent("android.settings.APP_NOTIFICATION_SETTINGS", [
      {
        key: "android.provider.extra.APP_PACKAGE",
        value: Application.applicationId ?? "dev.nedaa.android",
      },
    ]).catch(() => Linking.openSettings());
  } else {
    openAppSettings();
  }
};

const AlarmSettings = () => {
  const { t } = useTranslation();
  const { fajr, friday } = useAlarmSettingsStore();
  const { isRTL } = useRTL();
  const { becameActiveAt } = useAppVisibility();
  const hapticMedium = useHaptic("medium");

  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [skipGate, setSkipGate] = useState(false);

  const allGranted = permissions.length === 0 || permissions.every((p) => p.granted);
  const pendingPermissions = permissions.filter((p) => !p.granted);
  const currentPermission = pendingPermissions[0];
  const totalCount = permissions.length;

  const buildIOSPermission = useCallback(
    (granted: boolean, isDenied: boolean): PermissionItem => ({
      id: "alarmkit",
      icon: Bell,
      titleKey: "alarm.permission.ios.alarmkit.title",
      descriptionKey: "alarm.permission.ios.alarmkit.description",
      granted,
      canRequestInApp: !isDenied,
      onRequest: async () => {
        const result = await requestAuthorization();
        const nowGranted = result === "authorized";
        const nowDenied = result === "denied";
        if (nowDenied && isDenied) {
          openAppSettings();
        }
        setPermissions([buildIOSPermission(nowGranted, nowDenied)]);
      },
    }),
    []
  );

  const checkAllPermissions = useCallback(async () => {
    setIsCheckingPermissions(true);

    if (Platform.OS === PlatformType.IOS) {
      const alarmKitAvail = await isAlarmKitAvailable();
      if (!alarmKitAvail) {
        setSkipGate(true);
        setIsCheckingPermissions(false);
        return;
      }

      const status = await getAuthorizationStatus();
      setPermissions([buildIOSPermission(status === "authorized", status === "denied")]);
    } else {
      const items: PermissionItem[] = [];

      const { status: notifStatus } = await checkPermissions();
      const notifGranted = notifStatus === PermissionStatus.GRANTED;
      items.push({
        id: "notifications",
        icon: Bell,
        titleKey: "alarm.permission.android.notifications.title",
        descriptionKey: "alarm.permission.android.notifications.description",
        granted: notifGranted,
        canRequestInApp: notifStatus === PermissionStatus.UNDETERMINED,
        onRequest:
          notifStatus === PermissionStatus.UNDETERMINED
            ? async () => {
                await requestNotificationPermission();
                await checkAllPermissions();
              }
            : openNotificationSettings,
      });

      const exactGranted = canScheduleExactAlarms();
      items.push({
        id: "exactAlarm",
        icon: Clock,
        titleKey: "alarm.permission.android.exactAlarm.title",
        descriptionKey: "alarm.permission.android.exactAlarm.description",
        granted: exactGranted,
        canRequestInApp: false,
        onRequest: () => {
          requestExactAlarmPermission();
        },
      });

      const fullScreenGranted = canUseFullScreenIntent();
      items.push({
        id: "fullScreen",
        icon: Maximize,
        titleKey: "alarm.permission.android.fullScreen.title",
        descriptionKey: "alarm.permission.android.fullScreen.description",
        granted: fullScreenGranted,
        canRequestInApp: false,
        onRequest: () => {
          requestFullScreenIntentPermission();
        },
      });

      const batteryGranted = isBatteryOptimizationExempt();
      items.push({
        id: "battery",
        icon: BatteryCharging,
        titleKey: "alarm.permission.android.battery.title",
        descriptionKey: "alarm.permission.android.battery.description",
        granted: batteryGranted,
        canRequestInApp: false,
        onRequest: () => {
          requestBatteryOptimizationExemption();
        },
      });

      setPermissions(items);
    }

    setIsCheckingPermissions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildIOSPermission]);

  useEffect(() => {
    checkAllPermissions();
  }, [becameActiveAt, checkAllPermissions]);

  const handlePermissionRequest = (item: PermissionItem) => {
    hapticMedium();
    item.onRequest();
  };

  const alarmTypes = [
    {
      type: "fajr",
      title: t("alarm.settings.fajrAlarm"),
      description: t("alarm.settings.fajrDescription"),
      icon: Sun,
      enabled: fajr.enabled,
    },
    {
      type: "friday",
      title: t("alarm.settings.fridayAlarm"),
      description: t("alarm.settings.fridayDescription"),
      icon: Calendar,
      enabled: friday.enabled,
    },
  ];

  if (isCheckingPermissions) {
    return (
      <Background>
        <TopBar title="alarm.settings.title" href="/settings" backOnClick />
        <Box className="flex-1 items-center justify-center p-4">
          <Spinner size="large" />
        </Box>
      </Background>
    );
  }

  if (!allGranted && !skipGate && currentPermission) {
    return (
      <Background>
        <TopBar title="alarm.settings.title" href="/settings" backOnClick />
        <VStack className="flex-1 items-center justify-center px-8">
          <VStack className="items-center w-full" style={{ maxWidth: 320 }} space="xl">
            <Box className="w-24 h-24 rounded-full bg-background-info items-center justify-center">
              <Icon as={currentPermission.icon} size="xl" className="text-info" />
            </Box>

            <VStack space="sm" className="items-center">
              <Text className="text-2xl font-bold text-typography text-center">
                {t(currentPermission.titleKey)}
              </Text>
              <Text className="text-base text-typography-secondary text-center leading-relaxed">
                {t(currentPermission.descriptionKey)}
              </Text>
            </VStack>

            {totalCount > 1 && (
              <HStack space="xs" className="items-center">
                {permissions.map((p) => (
                  <Box
                    key={p.id}
                    className={`h-1.5 rounded-full ${
                      p.granted
                        ? "bg-success w-6"
                        : p.id === currentPermission.id
                          ? "bg-primary w-6"
                          : "bg-outline w-3"
                    }`}
                  />
                ))}
              </HStack>
            )}

            <VStack space="md" className="w-full items-center">
              <Button
                size="lg"
                variant="solid"
                className="w-full rounded-full bg-primary"
                onPress={() => handlePermissionRequest(currentPermission)}>
                <ButtonText className="font-semibold text-base text-typography-contrast">
                  {currentPermission.canRequestInApp
                    ? t("alarm.permission.allow")
                    : t("alarm.permission.openSettings")}
                </ButtonText>
              </Button>
            </VStack>
          </VStack>
        </VStack>
      </Background>
    );
  }

  return (
    <Background>
      <TopBar title="alarm.settings.title" href="/settings" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack className="flex-1">
          <Box className="mx-4 mt-4 mb-2">
            <Text className="text-left text-sm text-typography-secondary">
              {t("alarm.settings.description")}
            </Text>
          </Box>

          <VStack className="mx-2">
            {alarmTypes.map((alarm, index) => (
              <Box key={alarm.type}>
                <Pressable
                  className="p-4 rounded-xl bg-background-secondary m-2"
                  onPress={() => router.push(`/settings/alarm/${alarm.type}` as any)}>
                  <HStack className="justify-between items-center">
                    <HStack className="items-center flex-1" space="md">
                      <Box className="w-12 h-12 rounded-full bg-surface-active items-center justify-center">
                        <Icon as={alarm.icon} size="xl" className="text-typography" />
                      </Box>

                      <VStack className="flex-1">
                        <HStack className="items-center" space="sm">
                          <Text className="text-left text-lg font-semibold text-typography">
                            {alarm.title}
                          </Text>
                          <Badge
                            action={alarm.enabled ? "success" : "muted"}
                            size="sm"
                            className="rounded-full">
                            <BadgeText>
                              {alarm.enabled ? t("common.on") : t("common.off")}
                            </BadgeText>
                          </Badge>
                        </HStack>
                        <Text
                          className="text-left text-sm text-typography-secondary"
                          numberOfLines={2}>
                          {alarm.description}
                        </Text>
                      </VStack>
                    </HStack>

                    <Icon
                      as={ChevronRight}
                      size="lg"
                      className={`text-typography-secondary ${isRTL ? "rotate-180" : ""}`}
                    />
                  </HStack>
                </Pressable>

                {index < alarmTypes.length - 1 && (
                  <Divider className="bg-outline mx-6 w-[calc(100%-48px)]" />
                )}
              </Box>
            ))}
          </VStack>

          <Box className="mx-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push("/settings/alarm-debug")}>
              <ButtonText>Debug Panel</ButtonText>
            </Button>
          </Box>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmSettings;

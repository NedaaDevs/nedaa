import { useTranslation } from "react-i18next";
import { ScrollView, Platform, Linking } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import * as Application from "expo-application";
import { openComposer } from "react-native-email-link";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Icon, MailIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalBackdrop, ModalContent, ModalBody } from "@/components/ui/modal";
import TopBar from "@/components/TopBar";

import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

import {
  ChevronRight,
  Sun,
  Calendar,
  Bell,
  Clock,
  Maximize,
  BatteryCharging,
  MessageSquareWarning,
  BellOff,
  ClockAlert,
  VolumeOff,
  ShieldAlert,
  CircleHelp,
  ClipboardCopy,
} from "lucide-react-native";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useRTL } from "@/contexts/RTLContext";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";
import { useColorScheme } from "nativewind";

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

import { PlatformType, AppMode } from "@/enums/app";
import { AlarmLogger, type IssueCategory } from "@/utils/alarmLogger";

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
  const { colorScheme } = useColorScheme();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStep, setReportStep] = useState<"category" | "contact">("category");
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const whatsappNumber = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER;
  const telegramUsername = process.env.EXPO_PUBLIC_TELEGRAM_USERNAME;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  const issueOptions: { category: IssueCategory; icon: typeof Bell; labelKey: string }[] = [
    { category: "alarm_not_firing", icon: BellOff, labelKey: "alarm.report.alarmNotFiring" },
    { category: "wrong_time", icon: ClockAlert, labelKey: "alarm.report.wrongTime" },
    { category: "no_sound", icon: VolumeOff, labelKey: "alarm.report.noSound" },
    { category: "cant_dismiss", icon: ShieldAlert, labelKey: "alarm.report.cantDismiss" },
    { category: "other", icon: CircleHelp, labelKey: "alarm.report.other" },
  ];

  const handleCategorySelect = (category: IssueCategory) => {
    setSelectedCategory(category);
    setReportStep("contact");
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportStep("category");
    setSelectedCategory(null);
  };

  const handleShareViaEmail = async () => {
    if (!selectedCategory) return;
    setIsExporting(true);
    closeReportModal();
    try {
      const log = await AlarmLogger.getFullDebugLog(selectedCategory);
      const categoryLabel = t(
        issueOptions.find((o) => o.category === selectedCategory)?.labelKey ?? "alarm.report.other"
      );
      await openComposer({
        to: supportEmail,
        subject: `Nedaa Alarm: ${categoryLabel}`,
        body: log,
      });
    } catch (e) {
      console.error("Failed to open email:", e);
    }
    setIsExporting(false);
  };

  const handleShareViaWhatsApp = async () => {
    if (!selectedCategory || !whatsappNumber) return;
    setIsExporting(true);
    closeReportModal();
    try {
      const summary = await AlarmLogger.getSummary(selectedCategory);
      const encoded = encodeURIComponent(summary);
      await Linking.openURL(`https://wa.me/${whatsappNumber}?text=${encoded}`);
    } catch (e) {
      console.error("Failed to open WhatsApp:", e);
    }
    setIsExporting(false);
  };

  const handleShareViaTelegram = async () => {
    if (!selectedCategory || !telegramUsername) return;
    setIsExporting(true);
    closeReportModal();
    try {
      const summary = await AlarmLogger.getSummary(selectedCategory);
      const encoded = encodeURIComponent(summary);
      await Linking.openURL(`https://t.me/${telegramUsername}?text=${encoded}`);
    } catch (e) {
      console.error("Failed to open Telegram:", e);
    }
    setIsExporting(false);
  };

  const handleCopyToClipboard = async () => {
    if (!selectedCategory) return;
    closeReportModal();
    await AlarmLogger.copyLog(selectedCategory);
  };

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
  }, [buildIOSPermission]);

  useEffect(() => {
    checkAllPermissions();
  }, [becameActiveAt, checkAllPermissions]);

  const handlePermissionRequest = async (item: PermissionItem) => {
    hapticMedium();
    await item.onRequest();
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

          <Pressable
            className="mx-4 mt-8 mb-2 py-3 flex-row items-center justify-center"
            disabled={isExporting}
            onPress={() => {
              hapticMedium();
              setReportModalOpen(true);
            }}>
            <Icon as={MessageSquareWarning} size="sm" className="text-typography-secondary" />
            <Text className="text-sm text-typography-secondary ms-2">
              {isExporting ? t("alarm.report.exporting") : t("alarm.settings.reportProblem")}
            </Text>
          </Pressable>

          {__DEV__ && (
            <Box className="mx-4 mt-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/settings/alarm-debug")}>
                <ButtonText>Debug Panel</ButtonText>
              </Button>
            </Box>
          )}

          <Modal isOpen={reportModalOpen} onClose={closeReportModal} size="md">
            <ModalBackdrop />
            <ModalContent className="bg-background-secondary rounded-2xl">
              <ModalBody className="py-5 px-4">
                {reportStep === "category" ? (
                  <>
                    <Text className="text-lg font-semibold text-typography text-center mb-4">
                      {t("alarm.report.title")}
                    </Text>
                    <VStack space="sm">
                      {issueOptions.map((option) => (
                        <Pressable
                          key={option.category}
                          className="flex-row items-center py-3 px-3 rounded-xl active:bg-background-muted"
                          onPress={() => handleCategorySelect(option.category)}>
                          <Icon as={option.icon} size="md" className="text-typography-secondary" />
                          <Text className="text-base text-typography ms-3">
                            {t(option.labelKey)}
                          </Text>
                        </Pressable>
                      ))}
                    </VStack>
                  </>
                ) : (
                  <>
                    <Text className="text-lg font-semibold text-typography text-center mb-4">
                      {t("alarm.report.shareVia")}
                    </Text>
                    <VStack space="sm">
                      <Pressable
                        className="flex-row items-center py-3 px-3 rounded-xl active:bg-background-muted"
                        onPress={handleShareViaEmail}>
                        <Icon as={MailIcon} size="xl" className="text-accent-primary" />
                        <Text className="text-base text-typography ms-3">
                          {t("alarm.report.email")}
                        </Text>
                      </Pressable>

                      {whatsappNumber && (
                        <Pressable
                          className="flex-row items-center py-3 px-3 rounded-xl active:bg-background-muted"
                          onPress={handleShareViaWhatsApp}>
                          <FontAwesome5 name="whatsapp" size={24} color="#25D366" />
                          <Text className="text-base text-typography ms-3">
                            {t("alarm.report.whatsapp")}
                          </Text>
                        </Pressable>
                      )}

                      {telegramUsername && (
                        <Pressable
                          className="flex-row items-center py-3 px-3 rounded-xl active:bg-background-muted"
                          onPress={handleShareViaTelegram}>
                          <FontAwesome5
                            name="telegram-plane"
                            size={24}
                            color={colorScheme === AppMode.DARK ? "white" : "black"}
                          />
                          <Text className="text-base text-typography ms-3">
                            {t("alarm.report.telegram")}
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        className="flex-row items-center py-3 px-3 rounded-xl active:bg-background-muted"
                        onPress={handleCopyToClipboard}>
                        <Icon as={ClipboardCopy} size="xl" className="text-typography-secondary" />
                        <Text className="text-base text-typography ms-3">
                          {t("alarm.report.copyToClipboard")}
                        </Text>
                      </Pressable>
                    </VStack>

                    <Pressable
                      className="mt-4 py-2 items-center"
                      onPress={() => setReportStep("category")}>
                      <Text className="text-sm text-typography-secondary">
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                  </>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmSettings;

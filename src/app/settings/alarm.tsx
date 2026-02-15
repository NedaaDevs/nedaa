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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useAlarmStore } from "@/stores/alarm";
import { useRTL } from "@/contexts/RTLContext";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";
import { useTheme } from "tamagui";

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
import {
  getAlarmDiagnosticReport,
  getAlarmSummary,
  copyAlarmReport,
  type IssueCategory,
} from "@/utils/alarmReport";

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

const formatAlarmTime = (
  triggerTime: number,
  t: (key: string, options?: Record<string, string>) => string,
  locale: string
): string | null => {
  if (!triggerTime) return null;
  const triggerDate = new Date(triggerTime);
  if (triggerDate.getTime() <= Date.now()) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const triggerDay = new Date(
    triggerDate.getFullYear(),
    triggerDate.getMonth(),
    triggerDate.getDate()
  );

  let day: string;
  if (triggerDay.getTime() === today.getTime()) {
    day = t("alarm.settings.today");
  } else if (triggerDay.getTime() === tomorrow.getTime()) {
    day = t("alarm.settings.tomorrow");
  } else {
    day = triggerDate.toLocaleDateString(locale, { weekday: "long" });
  }

  const time = triggerDate.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return t("alarm.settings.firesAt", { day, time });
};

const AlarmSettings = () => {
  const { t, i18n } = useTranslation();
  const { fajr, friday } = useAlarmSettingsStore();
  const scheduledAlarms = useAlarmStore((s) => s.scheduledAlarms);
  const fajrAlarm = Object.values(scheduledAlarms).find((a) => a.alarmType === "fajr");
  const jummahAlarm = Object.values(scheduledAlarms).find((a) => a.alarmType === "jummah");
  const { isRTL } = useRTL();
  const { becameActiveAt } = useAppVisibility();
  const hapticMedium = useHaptic("medium");

  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [skipGate, setSkipGate] = useState(false);
  const theme = useTheme();
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
      const log = await getAlarmDiagnosticReport(selectedCategory);
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
      const summary = await getAlarmSummary(selectedCategory);
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
      const summary = await getAlarmSummary(selectedCategory);
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
    await copyAlarmReport(selectedCategory);
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
      firesAt:
        fajr.enabled && fajrAlarm ? formatAlarmTime(fajrAlarm.triggerTime, t, i18n.language) : null,
    },
    {
      type: "friday",
      title: t("alarm.settings.fridayAlarm"),
      description: t("alarm.settings.fridayDescription"),
      icon: Calendar,
      enabled: friday.enabled,
      firesAt:
        friday.enabled && jummahAlarm
          ? formatAlarmTime(jummahAlarm.triggerTime, t, i18n.language)
          : null,
    },
  ];

  if (isCheckingPermissions) {
    return (
      <Background>
        <TopBar title="alarm.settings.title" href="/settings" backOnClick />
        <Box flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Spinner size="large" />
        </Box>
      </Background>
    );
  }

  if (!allGranted && !skipGate && currentPermission) {
    return (
      <Background>
        <TopBar title="alarm.settings.title" href="/settings" backOnClick />
        <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8">
          <VStack alignItems="center" width="100%" maxWidth={320} gap="$5">
            <Box
              width={96}
              height={96}
              borderRadius={999}
              backgroundColor="$backgroundInfo"
              alignItems="center"
              justifyContent="center">
              <Icon as={currentPermission.icon} size="xl" color="$info" />
            </Box>

            <VStack gap="$2" alignItems="center">
              <Text size="2xl" bold color="$typography" textAlign="center">
                {t(currentPermission.titleKey)}
              </Text>
              <Text size="md" color="$typographySecondary" textAlign="center" lineHeight={22}>
                {t(currentPermission.descriptionKey)}
              </Text>
            </VStack>

            {totalCount > 1 && (
              <HStack gap="$1" alignItems="center">
                {permissions.map((p) => (
                  <Box
                    key={p.id}
                    height={6}
                    borderRadius={999}
                    backgroundColor={
                      p.granted
                        ? "$success"
                        : p.id === currentPermission.id
                          ? "$primary"
                          : "$outline"
                    }
                    width={p.granted || p.id === currentPermission.id ? 24 : 12}
                  />
                ))}
              </HStack>
            )}

            <VStack gap="$3" width="100%" alignItems="center">
              <Button
                size="lg"
                variant="solid"
                width="100%"
                borderRadius={999}
                backgroundColor="$primary"
                onPress={() => handlePermissionRequest(currentPermission)}>
                <Button.Text fontWeight="600" fontSize={16} color="$typographyContrast">
                  {currentPermission.canRequestInApp
                    ? t("alarm.permission.allow")
                    : t("alarm.permission.openSettings")}
                </Button.Text>
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
        <VStack flex={1}>
          <Box marginHorizontal="$4" marginTop="$4" marginBottom="$2">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.settings.description")}
            </Text>
          </Box>

          <VStack marginHorizontal="$2">
            {alarmTypes.map((alarm, index) => (
              <Box key={alarm.type}>
                <Pressable
                  padding="$4"
                  borderRadius="$6"
                  backgroundColor="$backgroundSecondary"
                  margin="$2"
                  onPress={() => router.push(`/settings/alarm/${alarm.type}` as any)}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack alignItems="center" flex={1} gap="$3">
                      <Box
                        width={48}
                        height={48}
                        borderRadius={999}
                        backgroundColor="$surfaceActive"
                        alignItems="center"
                        justifyContent="center">
                        <Icon as={alarm.icon} size="xl" color="$typography" />
                      </Box>

                      <VStack flex={1}>
                        <HStack alignItems="center" gap="$2">
                          <Text size="lg" fontWeight="600" color="$typography">
                            {alarm.title}
                          </Text>
                          <Badge
                            action={alarm.enabled ? "success" : "muted"}
                            size="sm"
                            borderRadius={999}>
                            <Badge.Text>
                              {alarm.enabled ? t("common.on") : t("common.off")}
                            </Badge.Text>
                          </Badge>
                        </HStack>
                        <Text size="sm" color="$typographySecondary" numberOfLines={2}>
                          {alarm.description}
                        </Text>
                        {alarm.firesAt && (
                          <Text size="xs" color="$primary" marginTop="$1">
                            {alarm.firesAt}
                          </Text>
                        )}
                      </VStack>
                    </HStack>

                    <Icon
                      as={ChevronRight}
                      size="lg"
                      color="$typographySecondary"
                      style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
                    />
                  </HStack>
                </Pressable>

                {index < alarmTypes.length - 1 && <Divider marginHorizontal="$6" />}
              </Box>
            ))}
          </VStack>

          <Pressable
            marginHorizontal="$4"
            marginTop="$8"
            marginBottom="$2"
            minHeight={44}
            disabled={isExporting}
            onPress={() => {
              hapticMedium();
              setReportModalOpen(true);
            }}>
            <HStack alignItems="center" justifyContent="center" width="100%" gap="$2">
              <Icon as={MessageSquareWarning} size="sm" color="$typographySecondary" />
              <Text size="sm" color="$typographySecondary">
                {isExporting ? t("alarm.report.exporting") : t("alarm.settings.reportProblem")}
              </Text>
            </HStack>
          </Pressable>

          {__DEV__ && (
            <Box marginHorizontal="$4" marginTop="$2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/settings/alarm-debug")}>
                <Button.Text>Debug Panel</Button.Text>
              </Button>
            </Box>
          )}

          <Modal isOpen={reportModalOpen} onClose={closeReportModal} size="md">
            <ModalBackdrop />
            <ModalContent>
              <ModalBody>
                {reportStep === "category" ? (
                  <>
                    <Text
                      size="lg"
                      fontWeight="600"
                      color="$typography"
                      textAlign="center"
                      marginBottom="$4">
                      {t("alarm.report.title")}
                    </Text>
                    <VStack gap="$2">
                      {issueOptions.map((option) => (
                        <Pressable
                          key={option.category}
                          minHeight={44}
                          paddingHorizontal="$3"
                          borderRadius="$6"
                          onPress={() => handleCategorySelect(option.category)}>
                          <HStack alignItems="center" width="100%" gap="$3">
                            <Icon as={option.icon} size="md" color="$typographySecondary" />
                            <Text size="md" color="$typography">
                              {t(option.labelKey)}
                            </Text>
                          </HStack>
                        </Pressable>
                      ))}
                    </VStack>
                  </>
                ) : (
                  <>
                    <Text
                      size="lg"
                      fontWeight="600"
                      color="$typography"
                      textAlign="center"
                      marginBottom="$4">
                      {t("alarm.report.shareVia")}
                    </Text>
                    <VStack gap="$2">
                      <Pressable
                        minHeight={44}
                        paddingHorizontal="$3"
                        borderRadius="$6"
                        onPress={handleShareViaEmail}>
                        <HStack alignItems="center" width="100%" gap="$3">
                          <Icon as={MailIcon} size="xl" color="$primary" />
                          <Text size="md" color="$typography">
                            {t("alarm.report.email")}
                          </Text>
                        </HStack>
                      </Pressable>

                      {whatsappNumber && (
                        <Pressable
                          minHeight={44}
                          paddingHorizontal="$3"
                          borderRadius="$6"
                          onPress={handleShareViaWhatsApp}>
                          <HStack alignItems="center" width="100%" gap="$3">
                            <FontAwesome5 name="whatsapp" size={24} color="#25D366" />
                            <Text size="md" color="$typography">
                              {t("alarm.report.whatsapp")}
                            </Text>
                          </HStack>
                        </Pressable>
                      )}

                      {telegramUsername && (
                        <Pressable
                          minHeight={44}
                          paddingHorizontal="$3"
                          borderRadius="$6"
                          onPress={handleShareViaTelegram}>
                          <HStack alignItems="center" width="100%" gap="$3">
                            <FontAwesome5
                              name="telegram-plane"
                              size={24}
                              color={theme.typography.val}
                            />
                            <Text size="md" color="$typography">
                              {t("alarm.report.telegram")}
                            </Text>
                          </HStack>
                        </Pressable>
                      )}

                      <Pressable
                        minHeight={44}
                        paddingHorizontal="$3"
                        borderRadius="$6"
                        onPress={handleCopyToClipboard}>
                        <HStack alignItems="center" width="100%" gap="$3">
                          <Icon as={ClipboardCopy} size="xl" color="$typographySecondary" />
                          <Text size="md" color="$typography">
                            {t("alarm.report.copyToClipboard")}
                          </Text>
                        </HStack>
                      </Pressable>
                    </VStack>

                    <Pressable
                      marginTop="$4"
                      minHeight={44}
                      justifyContent="center"
                      alignItems="center"
                      onPress={() => setReportStep("category")}>
                      <Text size="sm" color="$typographySecondary">
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

import { useTranslation } from "react-i18next";
import { ScrollView, Platform, Linking, View } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import * as Application from "expo-application";

import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalBackdrop, ModalContent, ModalBody } from "@/components/ui/modal";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import ReportProblemModal from "@/components/ReportProblemModal";

import {
  ChevronRight,
  ChevronLeft,
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
  Layers,
} from "lucide-react-native";

import { ScheduledAlarmType } from "@/enums/alarm";
import { SOUND_ASSETS } from "@/constants/sounds";
import { AlarmTypeSettings } from "@/types/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePreferencesStore } from "@/stores/preferences";
import { useRTL } from "@/contexts/RTLContext";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useHaptic } from "@/hooks/useHaptic";

import {
  requestAuthorization,
  requestExactAlarmPermission,
  requestFullScreenIntentPermission,
  requestBatteryOptimizationExemption,
  requestDrawOverlaysPermission,
} from "expo-alarm";

import { requestNotificationPermission } from "@/utils/notifications";
import { ALARM_PERMISSION, type AlarmPermissionId } from "@/constants/Alarm";
import { PRAYER_ID } from "@/constants/Prayer";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";

import { PlatformType } from "@/enums/app";
import {
  getAlarmDiagnosticReport,
  getAlarmSummary,
  copyAlarmReport,
  type IssueCategory,
} from "@/utils/alarmReport";

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

const PERMISSION_COPY: Record<
  AlarmPermissionId,
  { icon: typeof Bell; titleKey: string; descriptionKey: string }
> = {
  [ALARM_PERMISSION.ALARMKIT]: {
    icon: Bell,
    titleKey: "alarm.permission.ios.alarmkit.title",
    descriptionKey: "alarm.permission.ios.alarmkit.description",
  },
  [ALARM_PERMISSION.NOTIFICATIONS]: {
    icon: Bell,
    titleKey: "alarm.permission.android.notifications.title",
    descriptionKey: "alarm.permission.android.notifications.description",
  },
  [ALARM_PERMISSION.EXACT_ALARM]: {
    icon: Clock,
    titleKey: "alarm.permission.android.exactAlarm.title",
    descriptionKey: "alarm.permission.android.exactAlarm.description",
  },
  [ALARM_PERMISSION.FULL_SCREEN]: {
    icon: Maximize,
    titleKey: "alarm.permission.android.fullScreen.title",
    descriptionKey: "alarm.permission.android.fullScreen.description",
  },
  [ALARM_PERMISSION.OVERLAY]: {
    icon: Layers,
    titleKey: "alarm.permission.android.overlay.title",
    descriptionKey: "alarm.permission.android.overlay.description",
  },
  [ALARM_PERMISSION.BATTERY]: {
    icon: BatteryCharging,
    titleKey: "alarm.permission.android.battery.title",
    descriptionKey: "alarm.permission.android.battery.description",
  },
};

const REQUEST_PERMISSION: Record<
  AlarmPermissionId,
  (permission: AlarmPermission) => Promise<unknown> | void
> = {
  [ALARM_PERMISSION.ALARMKIT]: async ({ canRequestInApp }) => {
    // Once denied, iOS stops prompting and only Settings can grant it.
    if ((await requestAuthorization()) === "denied" && !canRequestInApp) openAppSettings();
  },
  [ALARM_PERMISSION.NOTIFICATIONS]: ({ canRequestInApp }) =>
    canRequestInApp ? requestNotificationPermission() : openNotificationSettings(),
  [ALARM_PERMISSION.EXACT_ALARM]: () => {
    requestExactAlarmPermission();
  },
  [ALARM_PERMISSION.FULL_SCREEN]: () => {
    requestFullScreenIntentPermission();
  },
  [ALARM_PERMISSION.OVERLAY]: () => {
    requestDrawOverlaysPermission();
  },
  [ALARM_PERMISSION.BATTERY]: () => {
    requestBatteryOptimizationExemption();
  },
};

const formatAlarmTime = (
  triggerTime: number,
  t: (key: string, options?: Record<string, string>) => string,
  locale: string,
  use24HourTime: boolean
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
    hour12: !use24HourTime,
  });

  return t("alarm.settings.firesAt", { day, time });
};

// One-line config digest: challenge type (+count) · sound name.
const formatConfigSummary = (
  settings: AlarmTypeSettings,
  t: (key: string, options?: Record<string, string | number>) => string
): string => {
  const { challenge, sound } = settings;
  const challengeLabel = t(`alarm.challenge.${challenge.type}`);
  const countPart = challenge.type !== "none" && challenge.count > 1 ? ` ×${challenge.count}` : "";
  const asset = SOUND_ASSETS[sound as keyof typeof SOUND_ASSETS];
  const soundName = asset ? t(asset.label) : t("alarm.settings.systemSound");
  return `${challengeLabel}${countPart} · ${soundName}`;
};

const AlarmSettings = () => {
  const { t, i18n } = useTranslation();
  const { fajr, friday } = useAlarmSettingsStore();
  const fajrStreak = useAlarmStreakStore((s) => s.streak);
  const scheduledAlarms = useAlarmStore((s) => s.scheduledAlarms);
  const fajrAlarm = Object.values(scheduledAlarms).find(
    (a) => a.alarmType === ScheduledAlarmType.FAJR
  );
  const jummahAlarm = Object.values(scheduledAlarms).find(
    (a) => a.alarmType === ScheduledAlarmType.JUMMAH
  );
  const { isRTL } = useRTL();
  const isDebugMode = useDebugModeStore((s) => s.isEnabled);
  const use24HourTime = usePreferencesStore((s) => s.use24HourTime);
  const { becameActiveAt } = useAppVisibility();
  const hapticMedium = useHaptic("medium");

  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissions, setPermissions] = useState<AlarmPermission[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);

  const issueOptions: { category: IssueCategory; icon: typeof Bell; labelKey: string }[] = [
    { category: "alarm_not_firing", icon: BellOff, labelKey: "alarm.report.alarmNotFiring" },
    { category: "wrong_time", icon: ClockAlert, labelKey: "alarm.report.wrongTime" },
    { category: "no_sound", icon: VolumeOff, labelKey: "alarm.report.noSound" },
    { category: "cant_dismiss", icon: ShieldAlert, labelKey: "alarm.report.cantDismiss" },
    { category: "other", icon: CircleHelp, labelKey: "alarm.report.other" },
  ];

  const handleCategorySelect = (category: IssueCategory) => {
    setSelectedCategory(category);
    setCategoryModalOpen(false);
    setShareModalOpen(true);
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setSelectedCategory(null);
  };

  const emailSubject = selectedCategory
    ? `Nedaa Alarm: ${t(issueOptions.find((o) => o.category === selectedCategory)?.labelKey ?? "alarm.report.other")}`
    : "Nedaa Alarm";

  const getReportText = useCallback(
    () => getAlarmDiagnosticReport(selectedCategory ?? undefined),
    [selectedCategory]
  );

  const getSummaryText = useCallback(() => getAlarmSummary(selectedCategory!), [selectedCategory]);

  const handleCopy = useCallback(async () => {
    await copyAlarmReport(selectedCategory ?? undefined);
  }, [selectedCategory]);

  const currentPermission = permissions.find((p) => !p.granted);
  const totalCount = permissions.length;

  // Re-read on every return to the app: most grants happen in system settings.
  useEffect(() => {
    let active = true;
    readAlarmPermissions().then((read) => {
      if (!active) return;
      setPermissions(read);
      setIsCheckingPermissions(false);
    });
    return () => {
      active = false;
    };
  }, [becameActiveAt]);

  const handlePermissionRequest = async (permission: AlarmPermission) => {
    hapticMedium();
    await REQUEST_PERMISSION[permission.id](permission);
    // An in-app prompt answers here; a settings screen answers on return.
    setPermissions(await readAlarmPermissions());
  };

  const alarmTypes = [
    {
      type: PRAYER_ID.FAJR,
      title: t("alarm.settings.fajrAlarm"),
      description: t("alarm.settings.fajrDescription"),
      icon: Sun,
      enabled: fajr.enabled,
      firesAt:
        fajr.enabled && fajrAlarm
          ? formatAlarmTime(fajrAlarm.triggerTime, t, i18n.language, use24HourTime)
          : null,
      configSummary: formatConfigSummary(fajr, t),
      streakLabel: fajrStreak >= 2 ? t("alarm.settings.streakStat", { count: fajrStreak }) : null,
    },
    {
      type: "friday",
      title: t("alarm.settings.fridayAlarm"),
      description: t("alarm.settings.fridayDescription"),
      icon: Calendar,
      enabled: friday.enabled,
      firesAt:
        friday.enabled && jummahAlarm
          ? formatAlarmTime(jummahAlarm.triggerTime, t, i18n.language, use24HourTime)
          : null,
      configSummary: formatConfigSummary(friday, t),
      streakLabel: null,
    },
  ];

  if (isCheckingPermissions) {
    return (
      <Background>
        <ScreenHeader
          title={t("alarm.settings.title")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
        <Box flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Spinner size="large" />
        </Box>
      </Background>
    );
  }

  if (currentPermission) {
    const copy = PERMISSION_COPY[currentPermission.id];
    return (
      <Background>
        <ScreenHeader
          title={t("alarm.settings.title")}
          back={{ fallback: BACK_DESTINATION.SETTINGS }}
        />
        <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8">
          <VStack alignItems="center" width="100%" maxWidth={320} gap="$5">
            <Box
              width={96}
              height={96}
              borderRadius={999}
              backgroundColor="$backgroundInfo"
              alignItems="center"
              justifyContent="center">
              <Icon as={copy.icon} size="xl" color="$info" />
            </Box>

            <VStack gap="$2" alignItems="center">
              <Text size="2xl" bold color="$typography" textAlign="center">
                {t(copy.titleKey)}
              </Text>
              <Text size="md" color="$typographySecondary" textAlign="center" lineHeight={22}>
                {t(copy.descriptionKey)}
              </Text>
            </VStack>

            {totalCount > 1 && (
              <HStack
                gap="$1"
                alignItems="center"
                accessible={true}
                accessibilityLabel={t("a11y.stepProgress", {
                  current: permissions.filter((p) => p.granted).length + 1,
                  total: totalCount,
                })}>
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
      <ScreenHeader
        title={t("alarm.settings.title")}
        subtitle={t("alarm.settings.description")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1}>
          <VStack marginHorizontal="$2">
            {alarmTypes.map((alarm, index) => (
              <Box key={alarm.type}>
                <Card.Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${alarm.title}. ${alarm.configSummary}`}
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
                        <Text
                          size="xs"
                          color="$typographySecondary"
                          numberOfLines={1}
                          marginTop="$1">
                          {alarm.configSummary}
                        </Text>
                        {alarm.firesAt && (
                          <Text size="xs" color="$primary" marginTop="$1">
                            {alarm.firesAt}
                          </Text>
                        )}
                        {alarm.streakLabel && (
                          <Text size="xs" color="$warning" marginTop="$1">
                            {alarm.streakLabel}
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
                </Card.Pressable>

                {index < alarmTypes.length - 1 && <Divider marginHorizontal="$6" />}
              </Box>
            ))}
          </VStack>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("alarm.settings.reportProblem")}
            marginHorizontal="$4"
            marginTop="$8"
            marginBottom="$2"
            minHeight={44}
            onPress={() => {
              hapticMedium();
              setCategoryModalOpen(true);
            }}>
            <HStack alignItems="center" justifyContent="center" width="100%" gap="$2">
              <Icon as={MessageSquareWarning} size="sm" color="$typographySecondary" />
              <Text size="sm" color="$typographySecondary">
                {t("alarm.settings.reportProblem")}
              </Text>
            </HStack>
          </Pressable>

          {isDebugMode && (
            <Box marginHorizontal="$4" marginTop="$2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/settings/alarm-debug")}>
                <Button.Text>Debug Panel</Button.Text>
              </Button>
            </Box>
          )}

          <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} size="sm">
            <ModalBackdrop />
            <ModalContent>
              <ModalBody>
                {/* Re-apply direction inside the Dialog portal — it renders outside the
                    RTLProvider's direction wrapper, so flex rows don't flip otherwise. */}
                <View style={{ direction: isRTL ? "rtl" : "ltr", width: "100%" }}>
                  <VStack gap="$3" paddingVertical="$3">
                    <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
                      {t("alarm.report.title")}
                    </Text>

                    <VStack gap="$1">
                      {issueOptions.map((option) => (
                        <Pressable
                          key={option.category}
                          accessibilityRole="button"
                          accessibilityLabel={t(option.labelKey)}
                          onPress={() => handleCategorySelect(option.category)}
                          minHeight={56}
                          paddingHorizontal="$2"
                          borderRadius="$4"
                          pressStyle={{ backgroundColor: "$backgroundHover" }}>
                          <HStack alignItems="center" width="100%" gap="$3">
                            <HStack alignItems="center" gap="$3" flex={1}>
                              <Box
                                width={40}
                                height={40}
                                borderRadius={20}
                                backgroundColor="$primarySubtle"
                                alignItems="center"
                                justifyContent="center">
                                <Icon as={option.icon} size="sm" color="$primary" />
                              </Box>
                              <Text size="md" fontWeight="500" color="$typography">
                                {t(option.labelKey)}
                              </Text>
                            </HStack>
                            <Icon
                              as={isRTL ? ChevronLeft : ChevronRight}
                              size="sm"
                              color="$typographySecondary"
                            />
                          </HStack>
                        </Pressable>
                      ))}
                    </VStack>

                    <Divider marginVertical="$1" />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("common.cancel")}
                      onPress={() => setCategoryModalOpen(false)}
                      minHeight={48}
                      borderRadius="$4"
                      backgroundColor="$backgroundMuted"
                      justifyContent="center"
                      alignItems="center"
                      pressStyle={{ backgroundColor: "$backgroundHover" }}>
                      <Text size="md" fontWeight="600" color="$primary">
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                  </VStack>
                </View>
              </ModalBody>
            </ModalContent>
          </Modal>

          <ReportProblemModal
            isOpen={shareModalOpen}
            onClose={closeShareModal}
            emailSubject={emailSubject}
            getReportText={getReportText}
            getSummaryText={getSummaryText}
            feedbackArea="alarms"
            onCopy={handleCopy}
          />
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmSettings;

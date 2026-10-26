import { useTranslation } from "react-i18next";
import { ScrollView, Platform, View } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";

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
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalBackdrop, ModalContent, ModalBody } from "@/components/ui/modal";
import { ScreenHeader } from "@/components/ui/screen-header";
import type { StateAction } from "@/components/ui/state-panel";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
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
  Volume1,
  Activity,
  MapPin,
  type LucideIcon,
} from "lucide-react-native";

import { BUNDLED_SOUNDS } from "@/constants/sounds";
import { AlarmTypeSettings } from "@/types/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { useDebugModeStore } from "@/stores/debugMode";
import { useRTL } from "@/contexts/RTLContext";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useAlarmArmed } from "@/hooks/useAlarmArmed";
import { useAlarmOn } from "@/hooks/useAlarmOn";
import { useHaptic } from "@/hooks/useHaptic";
import { useClockTime, type ClockTime } from "@/hooks/useClockTime";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useVerifiedPlace } from "@/hooks/useVerifiedPlace";

import { CHALLENGE_TYPE } from "expo-alarm";

import {
  ALARM_PERMISSION,
  ALARM_PERMISSION_TITLE_KEY,
  ALARM_TYPE,
  alarmSettingsHref,
  isNeededPermission,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import {
  readAlarmPermissions,
  requestAlarmPermission,
  type AlarmPermission,
} from "@/utils/alarmPermissions";

import { PlatformType } from "@/enums/app";
import { deviceTimeZone } from "@/utils/date";
import {
  getAlarmDiagnosticReport,
  getAlarmSummary,
  copyAlarmReport,
  type IssueCategory,
} from "@/utils/alarmReport";

// Titles are ALARM_PERMISSION_TITLE_KEY's: one name per permission.
const PERMISSION_COPY: Record<AlarmPermissionId, { icon: LucideIcon; descriptionKey: string }> = {
  [ALARM_PERMISSION.ALARMKIT]: {
    icon: Bell,
    descriptionKey: "alarm.permission.ios.alarmkit.description",
  },
  [ALARM_PERMISSION.LIVE_ACTIVITIES]: {
    icon: Activity,
    descriptionKey: "alarm.permission.ios.liveActivities.description",
  },
  [ALARM_PERMISSION.NOTIFICATIONS]: {
    icon: Bell,
    descriptionKey: "alarm.permission.android.notifications.description",
  },
  [ALARM_PERMISSION.EXACT_ALARM]: {
    icon: Clock,
    descriptionKey: "alarm.permission.android.exactAlarm.description",
  },
  [ALARM_PERMISSION.FULL_SCREEN]: {
    icon: Maximize,
    descriptionKey: "alarm.permission.android.fullScreen.description",
  },
  [ALARM_PERMISSION.OVERLAY]: {
    icon: Layers,
    descriptionKey: "alarm.permission.android.overlay.description",
  },
  [ALARM_PERMISSION.BATTERY]: {
    icon: BatteryCharging,
    descriptionKey: "alarm.permission.android.battery.description",
  },
};

type GateSteps = { items: readonly AlarmPermission[]; current: AlarmPermissionId };

type GatePageProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** The way on; `testID` marks it for the CI flows. */
  action: StateAction & { testID?: string };
  /** Passes the page for this visit; a page the alarm needs has none. */
  pass?: StateAction;
  /** Every permission, the one this page asks for marked. */
  steps?: GateSteps;
};

/** One thing the alarms wait on, and the way to it. */
const GatePage = ({ icon, title, body, action, pass, steps }: GatePageProps) => {
  const { t } = useTranslation();
  return (
    <Background>
      <ScreenHeader
        title={t("alarm.settings.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />
      <VStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$8">
        <VStack alignItems="center" width="100%" maxWidth={320} gap="$5">
          <Box
            width="$24"
            height="$24"
            borderRadius="$pill"
            backgroundColor="$backgroundInfo"
            alignItems="center"
            justifyContent="center">
            <Icon as={icon} size="xl" color="$info" />
          </Box>

          <VStack gap="$2" alignItems="center">
            <Text size="2xl" bold color="$typography" textAlign="center">
              {title}
            </Text>
            <Text size="md" color="$typographySecondary" textAlign="center" lineHeight={22}>
              {body}
            </Text>
          </VStack>

          {steps && steps.items.length > 1 && (
            <HStack
              gap="$1"
              alignItems="center"
              accessible={true}
              accessibilityLabel={t("a11y.stepProgress", {
                current: steps.items.findIndex(({ id }) => id === steps.current) + 1,
                total: steps.items.length,
              })}>
              {steps.items.map(({ id, granted }) => (
                <Box
                  key={id}
                  height="$1.5"
                  borderRadius="$pill"
                  backgroundColor={
                    granted ? "$success" : id === steps.current ? "$primary" : "$outline"
                  }
                  width={granted || id === steps.current ? "$6" : "$3"}
                />
              ))}
            </HStack>
          )}

          <VStack gap="$3" width="100%" alignItems="center">
            <Button
              testID={action.testID}
              size="lg"
              variant="solid"
              width="100%"
              borderRadius="$pill"
              backgroundColor="$primary"
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.hint}>
              <Button.Text fontWeight="600" fontSize={16} color="$typographyContrast">
                {action.label}
              </Button.Text>
            </Button>
            {pass && (
              <Button
                action="secondary"
                variant="outline"
                size="lg"
                width="100%"
                borderRadius="$pill"
                onPress={pass.onPress}
                accessibilityRole="button"
                accessibilityLabel={pass.label}>
                <Button.Text>{pass.label}</Button.Text>
              </Button>
            )}
          </VStack>
        </VStack>
      </VStack>
    </Background>
  );
};

// The ring time as drawn and as spoken, both in the device's wall clock.
const formatAlarmTime = (
  triggerTime: number,
  t: (key: string, options?: Record<string, string>) => string,
  locale: string,
  clock: ReturnType<typeof useClockTime>
): ClockTime | null => {
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

  const { shown, spoken } = clock(triggerDate, deviceTimeZone());
  return {
    shown: t("alarm.settings.firesAt", { day, time: shown }),
    spoken: t("alarm.settings.firesAt", { day, time: spoken }),
  };
};

// One-line config digest: challenge type (+count) · sound name.
const formatConfigSummary = (
  settings: AlarmTypeSettings,
  t: (key: string, options?: Record<string, string | number>) => string
): string => {
  const { challenge, sound } = settings;
  const challengeLabel = t(`alarm.challenge.${challenge.type}`);
  const countPart =
    challenge.type !== CHALLENGE_TYPE.NONE && challenge.count > 1 ? ` ×${challenge.count}` : "";
  const asset = BUNDLED_SOUNDS[sound];
  const soundName = asset ? t(asset.label) : t("alarm.settings.systemSound");
  return `${challengeLabel}${countPart} · ${soundName}`;
};

const AlarmSettings = () => {
  const { t, i18n } = useTranslation();
  const { fajr, friday } = useAlarmSettingsStore();
  const fajrOn = useAlarmOn(ALARM_TYPE.FAJR);
  const fridayOn = useAlarmOn(ALARM_TYPE.FRIDAY);
  const fajrStreak = useAlarmStreakStore((s) => s.streak);
  const { isRTL } = useRTL();
  const isDebugMode = useDebugModeStore((s) => s.isEnabled);
  const clock = useClockTime();
  const { becameActiveAt } = useAppVisibility();
  const hapticMedium = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const verifiedPlace = useVerifiedPlace();
  const fajrArmed = useAlarmArmed(ALARM_TYPE.FAJR);
  const fridayArmed = useAlarmArmed(ALARM_TYPE.FRIDAY);
  const onOff = (on: boolean) => (on ? t("common.on") : t("common.off"));

  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissions, setPermissions] = useState<AlarmPermission[]>([]);
  // Improvements passed with Not now; this visit only, the next one asks again.
  const [passed, setPassed] = useState<ReadonlySet<AlarmPermissionId>>(() => new Set());
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

  // A missing needed item blocks the alarms; only an improvement can be passed.
  const currentPermission = permissions.find(({ id, granted }) => !granted && !passed.has(id));

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
    await requestAlarmPermission(permission);
    // An in-app prompt answers here; a settings screen answers on return.
    setPermissions(await readAlarmPermissions());
  };

  const alarmTypes = [
    {
      type: ALARM_TYPE.FAJR,
      title: t("alarm.settings.fajrAlarm"),
      description: t("alarm.settings.fajrDescription"),
      icon: Sun,
      enabled: fajrOn,
      firesAt:
        fajrOn && fajrArmed
          ? formatAlarmTime(fajrArmed.triggerTime, t, i18n.language, clock)
          : null,
      configSummary: formatConfigSummary(fajr, t),
      streak:
        fajrStreak >= 2
          ? {
              shown: t("alarm.settings.streakStat", { count: fajrStreak }),
              spoken: t("a11y.alarm.streak", { count: fajrStreak }),
            }
          : null,
    },
    {
      type: ALARM_TYPE.FRIDAY,
      title: t("alarm.settings.fridayAlarm"),
      description: t("alarm.settings.fridayDescription"),
      icon: Calendar,
      enabled: fridayOn,
      firesAt:
        fridayOn && fridayArmed
          ? formatAlarmTime(fridayArmed.triggerTime, t, i18n.language, clock)
          : null,
      configSummary: formatConfigSummary(friday, t),
      streak: null,
    },
  ];

  // Alarms ring at the city's times, so it comes first unless one is armed.
  if (!verifiedPlace && !fajrArmed && !fridayArmed) {
    return (
      <GatePage
        icon={MapPin}
        title={t("alarm.settings.cityNeeded.title")}
        body={t("alarm.settings.cityNeeded.body")}
        action={{
          label: t("alarm.settings.cityNeeded.action"),
          hint: t("a11y.today.locationHint"),
          testID: E2E_ID.ALARM_CHOOSE_CITY,
          onPress: () => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href),
        }}
      />
    );
  }

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
    const { id } = currentPermission;
    return (
      <GatePage
        icon={PERMISSION_COPY[id].icon}
        title={t(ALARM_PERMISSION_TITLE_KEY[id])}
        body={t(PERMISSION_COPY[id].descriptionKey)}
        action={{
          label: currentPermission.canRequestInApp
            ? t("alarm.permission.allow")
            : t("alarm.permission.openSettings"),
          onPress: () => handlePermissionRequest(currentPermission),
        }}
        pass={
          isNeededPermission(id)
            ? undefined
            : {
                label: t("common.notNow"),
                onPress: () => setPassed((before) => new Set(before).add(id)),
              }
        }
        steps={{ items: permissions, current: id }}
      />
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
                  accessibilityLabel={[
                    `${alarm.title}, ${onOff(alarm.enabled)}`,
                    alarm.configSummary,
                    alarm.firesAt?.spoken,
                    alarm.streak?.spoken,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  accessibilityHint={t("a11y.opens", { name: alarm.title })}
                  margin="$2"
                  onPress={() => router.push(alarmSettingsHref(alarm.type))}>
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
                            <Badge.Text>{onOff(alarm.enabled)}</Badge.Text>
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
                            {alarm.firesAt.shown}
                          </Text>
                        )}
                        {alarm.streak && (
                          <Text size="xs" color="$warning" marginTop="$1">
                            {alarm.streak.shown}
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

          {/* Only Android plays sounds the user adds. */}
          {Platform.OS === PlatformType.ANDROID && (
            <Box marginHorizontal="$4" marginTop="$4">
              <ListRow
                icon={Volume1}
                title={t("notification.customSound.manage")}
                hint={t("a11y.opens", {
                  name: t(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.title),
                })}
                onPress={() => router.push(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.href)}
              />
            </Box>
          )}

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

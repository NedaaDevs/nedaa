import { useTranslation } from "react-i18next";
import { ScrollView, Linking, Platform } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import ScheduledNotificationDebugModal from "@/components/ScheduledNotificationDebugModal";

import TopBar from "@/components/TopBar";
import NotificationQuickSetup from "@/components/NotificationQuickSetup";
import NotificationTypePanel from "@/components/NotificationTypePanel";

// Icons
import { Bell, Volume1 } from "lucide-react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useHaptic } from "@/hooks/useHaptic";
import { useAppVisibility } from "@/hooks/useAppVisibility";

// Utils
import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";

// Types
import { PermissionStatus } from "expo-notifications";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { Background } from "@/components/ui/background";

// Utils

import { debugChannelInfo } from "@/utils/notificationChannels";
import { scheduleAthan, stopAthan, isAthanPlaying } from "expo-alarm";

const NotificationSettings = () => {
  const { t } = useTranslation();
  const { becameActiveAt } = useAppVisibility();
  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");

  const {
    settings,
    isScheduling,
    features,
    totalOverrideCount,
    updateAllNotificationToggle,
    updateQuickSetup,
    updateDefault,
    updateOverride,
    resetOverride,
    scheduleAllNotifications,
  } = useNotificationSettings();

  // Permission state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canAskPermission, setCanAskPermission] = useState(true);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // For debugging
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Check permission when app becomes active (user returns from settings)
  useEffect(() => {
    checkPermissionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [becameActiveAt]);

  const checkPermissionStatus = async () => {
    setIsCheckingPermission(true);
    try {
      const { status } = await checkPermissions();
      const granted = status === PermissionStatus.GRANTED;

      setHasPermission(granted);
      // On iOS, if permission is denied, we can only redirect to settings
      // On Android, we might be able to ask again depending on the situation
      setCanAskPermission(status === PermissionStatus.UNDETERMINED);

      // If permission is granted, ensure notifications are scheduled
      if (granted) {
        await scheduleAllNotifications();
      }
    } catch (error) {
      console.error("Failed to check notification permission:", error);
      setHasPermission(false);
      setCanAskPermission(false);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const handleRequestPermission = async () => {
    hapticMedium();
    try {
      const { status } = await requestNotificationPermission();
      const granted = status === PermissionStatus.GRANTED;
      setHasPermission(granted);

      // Schedule notifications immediately after permission is granted
      if (granted) {
        await scheduleAllNotifications();
      }
    } catch (error) {
      console.error("Failed to request notification permission:", error);
    }
  };

  const openAppSettings = () => {
    hapticMedium();
    if (Platform.OS === PlatformType.IOS) {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const handleNotificationList = () => {
    setShowNotificationsModal(true);
  };

  // Show permission request UI if no permission
  if (isCheckingPermission) {
    return (
      <Background>
        <TopBar title="settings.notification.title" href="/" backOnClick />
        <Box flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$typography">{t("common.loading")}</Text>
        </Box>
      </Background>
    );
  }

  if (!hasPermission) {
    return (
      <Background>
        <TopBar title="settings.notification.title" href="/" backOnClick />
        <VStack flex={1} padding="$4" alignItems="center" justifyContent="center" gap="$4">
          <Card padding="$6" width="100%" style={{ maxWidth: 320 }}>
            <VStack gap="$4" alignItems="center">
              <Box
                width={80}
                height={80}
                borderRadius={999}
                backgroundColor="$backgroundInfo"
                alignItems="center"
                justifyContent="center">
                <Icon color="$info" as={Bell} size="xl" />
              </Box>

              <VStack gap="$2" alignItems="center">
                <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
                  {t("notification.permission.title")}
                </Text>
                <Text
                  size="sm"
                  color="$typographySecondary"
                  textAlign="center"
                  paddingHorizontal="$2">
                  {t("notification.permission.description")}
                </Text>
              </VStack>

              {canAskPermission ? (
                <Box width="100%" alignItems="center">
                  <Button
                    onPress={handleRequestPermission}
                    paddingHorizontal="$7"
                    backgroundColor="$primary"
                    size="lg">
                    <Button.Text fontWeight="500" color="$typographyContrast">
                      {t("notification.permission.allow")}
                    </Button.Text>
                  </Button>
                </Box>
              ) : (
                <VStack gap="$2" width="100%" alignItems="center">
                  <Text color="$typography" textAlign="center" paddingHorizontal="$2">
                    {t("notification.permission.deniedMessage")}
                  </Text>
                  <Button
                    onPress={openAppSettings}
                    paddingHorizontal="$7"
                    backgroundColor="$primary"
                    size="lg">
                    <Button.Text fontWeight="500" color="$typographyContrast">
                      {t("notification.permission.openSettings")}
                    </Button.Text>
                  </Button>
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      </Background>
    );
  }

  return (
    <Background>
      <TopBar title="settings.notification.title" href="/" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}>
        <VStack flex={1} gap="$3">
          {/* Master Toggle */}
          <Box
            backgroundColor="$backgroundSecondary"
            marginHorizontal="$4"
            marginTop="$4"
            borderRadius="$4">
            <HStack padding="$4" justifyContent="space-between" alignItems="center">
              <VStack flex={1}>
                <Text size="lg" fontWeight="600" color="$typography">
                  {t("notification.enableAll")}
                </Text>
                {totalOverrideCount > 0 && (
                  <Badge size="sm" variant="outline" marginTop="$1" alignSelf="flex-start">
                    <Badge.Text>
                      {totalOverrideCount} {t("notification.customSettings")}
                    </Badge.Text>
                  </Badge>
                )}
              </VStack>
              <Switch
                value={settings.enabled}
                onValueChange={(value) => {
                  hapticSelection();
                  updateAllNotificationToggle(value);
                }}
                size="lg"
              />
            </HStack>
          </Box>

          {settings.enabled && (
            <>
              {/* Quick Setup */}
              <NotificationQuickSetup
                currentSound={settings.defaults.prayer.sound}
                vibrationEnabled={settings.defaults.prayer.vibration}
                onApply={updateQuickSetup}
                supportsVibration={features.supportsVibration}
              />

              {/* Custom Sounds Button (Android Only) */}
              {Platform.OS === PlatformType.ANDROID && (
                <Box marginHorizontal="$4">
                  <Button
                    size="lg"
                    backgroundColor="$accentPrimary"
                    borderRadius="$6"
                    onPress={() => {
                      hapticMedium();
                      router.push("/settings/customSounds");
                    }}>
                    <Icon as={Volume1} size="md" color="$typographyContrast" />
                    <Button.Text color="$typographyContrast" fontWeight="600">
                      {t("notification.customSound.manage")}
                    </Button.Text>
                  </Button>
                </Box>
              )}

              {/* Prayer Notifications */}
              <NotificationTypePanel
                type={NOTIFICATION_TYPE.PRAYER}
                title={t("notification.prayerNotifications")}
                icon="Bell"
                defaults={settings.defaults.prayer}
                overrides={settings.overrides}
                onDefaultUpdate={(field, value) =>
                  updateDefault(NOTIFICATION_TYPE.PRAYER, field, value)
                }
                onOverrideUpdate={(prayerId, config) =>
                  updateOverride(prayerId, NOTIFICATION_TYPE.PRAYER, config)
                }
                onResetOverride={(prayerId) => resetOverride(prayerId, NOTIFICATION_TYPE.PRAYER)}
                defaultExpanded={true}
                supportsVibration={features.supportsVibration}
              />

              {/* Iqama Reminders */}
              <NotificationTypePanel
                type={NOTIFICATION_TYPE.IQAMA}
                title={t("notification.iqamaReminders")}
                icon="Clock"
                defaults={settings.defaults.iqama}
                overrides={settings.overrides}
                onDefaultUpdate={(field, value) =>
                  updateDefault(NOTIFICATION_TYPE.IQAMA, field, value)
                }
                onOverrideUpdate={(prayerId, config) =>
                  updateOverride(prayerId, NOTIFICATION_TYPE.IQAMA, config)
                }
                onResetOverride={(prayerId) => resetOverride(prayerId, NOTIFICATION_TYPE.IQAMA)}
                hasTiming={true}
                timingLabel={t("notification.timeAfterAthan")}
                supportsVibration={features.supportsVibration}
              />

              {/* Pre-Athan Alerts */}
              <NotificationTypePanel
                type={NOTIFICATION_TYPE.PRE_ATHAN}
                title={t("notification.preAthanAlerts")}
                icon="BellRing"
                defaults={settings.defaults.preAthan}
                overrides={settings.overrides}
                onDefaultUpdate={(field, value) =>
                  updateDefault(NOTIFICATION_TYPE.PRE_ATHAN, field, value)
                }
                onOverrideUpdate={(prayerId, config) =>
                  updateOverride(prayerId, NOTIFICATION_TYPE.PRE_ATHAN, config)
                }
                onResetOverride={(prayerId) => resetOverride(prayerId, NOTIFICATION_TYPE.PRE_ATHAN)}
                hasTiming={true}
                timingLabel={t("notification.timeBeforeAthan")}
                supportsVibration={features.supportsVibration}
              />

              {/* Sync Status */}
              {isScheduling && (
                <Box
                  backgroundColor="$backgroundMuted"
                  marginHorizontal="$4"
                  padding="$3"
                  borderRadius="$4">
                  <HStack gap="$2" alignItems="center">
                    <Text size="sm" color="$typography">
                      {t("notification.schedulingNotifications")}...
                    </Text>
                  </HStack>
                </Box>
              )}
            </>
          )}

          {/* Debug/Test Section */}
          {__DEV__ && (
            <>
              <Box marginHorizontal="$4" marginTop="$4">
                <Button variant="outline" size="sm" onPress={scheduleAllNotifications}>
                  <Button.Text>Reschedule All Notifications</Button.Text>
                </Button>
              </Box>
              <Box marginHorizontal="$4" marginTop="$4">
                <Button variant="outline" size="sm" onPress={handleNotificationList}>
                  <Button.Text>List All Notifications</Button.Text>
                </Button>
              </Box>

              {/* Debug channel info */}
              <Box marginHorizontal="$4" marginTop="$2">
                <Button variant="outline" size="sm" onPress={debugChannelInfo}>
                  <Button.Text>Debug Channel Info</Button.Text>
                </Button>
              </Box>

              {/* Test Athan Service (Android only) */}
              {Platform.OS === PlatformType.ANDROID && (
                <Box marginHorizontal="$4" marginTop="$2" gap="$2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={async () => {
                      const triggerDate = new Date(Date.now() + 10_000);
                      const ok = await scheduleAthan({
                        id: `test_athan_${Date.now()}`,
                        triggerDate,
                        prayerId: "fajr",
                        soundName: "makkah_athan1",
                        title: t("prayerTimes.fajr"),
                        stopLabel: t("common.stop"),
                      });
                      console.log(
                        `[AthanTest] Scheduled test athan in 10s: ${ok ? "OK" : "FAILED"}`
                      );
                    }}>
                    <Button.Text>Test Athan (10s)</Button.Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    action="negative"
                    onPress={() => {
                      const playing = isAthanPlaying();
                      console.log(`[AthanTest] isPlaying: ${playing}`);
                      if (playing) stopAthan();
                    }}>
                    <Button.Text>Stop Athan</Button.Text>
                  </Button>
                </Box>
              )}
            </>
          )}
        </VStack>
      </ScrollView>

      <ScheduledNotificationDebugModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
    </Background>
  );
};

export default NotificationSettings;

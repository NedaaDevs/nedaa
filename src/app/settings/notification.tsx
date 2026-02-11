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
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
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
        <Box className="flex-1 items-center justify-center p-4">
          <Text className="text-typography">{t("common.loading")}</Text>
        </Box>
      </Background>
    );
  }

  if (!hasPermission) {
    return (
      <Background>
        <TopBar title="settings.notification.title" href="/" backOnClick />
        <VStack className="flex-1 p-4 items-center justify-center" space="lg">
          <Card className="p-6 w-full" style={{ maxWidth: 320 }}>
            <VStack space="lg" className="items-center">
              <Box className="w-20 h-20 rounded-full bg-background-info items-center justify-center">
                <Icon className="text-info" as={Bell} size="xl" />
              </Box>

              <VStack space="sm" className="items-center">
                <Text className="text-xl font-semibold text-typography text-center">
                  {t("notification.permission.title")}
                </Text>
                <Text className="text-sm text-typography-secondary text-center px-2">
                  {t("notification.permission.description")}
                </Text>
              </VStack>

              {canAskPermission ? (
                <Box className="w-full items-center">
                  <Button onPress={handleRequestPermission} className="px-12 bg-primary" size="lg">
                    <ButtonText className="font-medium text-typography-contrast">
                      {t("notification.permission.allow")}
                    </ButtonText>
                  </Button>
                </Box>
              ) : (
                <VStack space="sm" className="w-full items-center">
                  <Text className="text-md text-typography text-center px-2">
                    {t("notification.permission.deniedMessage")}
                  </Text>
                  <Button onPress={openAppSettings} className="px-12 bg-primary" size="lg">
                    <ButtonText className="font-medium text-md text-typography-contrast">
                      {t("notification.permission.openSettings")}
                    </ButtonText>
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
        <VStack className="flex-1" space="md">
          {/* Master Toggle */}
          <Box className="bg-background-secondary mx-4 mt-4 rounded-lg">
            <HStack className="p-4 justify-between items-center">
              <VStack className="flex-1">
                <Text className="text-left text-lg font-semibold text-typography">
                  {t("notification.enableAll")}
                </Text>
                {totalOverrideCount > 0 && (
                  <Badge size="sm" variant="outline" className="mt-1 self-start">
                    <BadgeText>
                      {totalOverrideCount} {t("notification.customSettings")}
                    </BadgeText>
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
                <Box className="mx-4">
                  <Button
                    size="lg"
                    className="bg-accent-primary rounded-xl"
                    onPress={() => {
                      hapticMedium();
                      router.push("/settings/customSounds");
                    }}>
                    <Icon as={Volume1} size="md" className="text-background mr-2" />
                    <ButtonText className="text-background font-semibold">
                      {t("notification.customSound.manage")}
                    </ButtonText>
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
                <Box className="bg-background-muted mx-4 p-3 rounded-lg">
                  <HStack space="sm" className="items-center">
                    <Text className="text-sm text-typography">
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
              <Box className="mx-4 mt-4">
                <Button variant="outline" size="sm" onPress={scheduleAllNotifications}>
                  <ButtonText>Reschedule All Notifications</ButtonText>
                </Button>
              </Box>
              <Box className="mx-4 mt-4">
                <Button variant="outline" size="sm" onPress={handleNotificationList}>
                  <ButtonText>List All Notifications</ButtonText>
                </Button>
              </Box>

              {/* Debug channel info */}
              <Box className="mx-4 mt-2">
                <Button variant="outline" size="sm" onPress={debugChannelInfo}>
                  <ButtonText>Debug Channel Info</ButtonText>
                </Button>
              </Box>
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

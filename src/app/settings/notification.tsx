import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";

import TopBar from "@/components/TopBar";
import NotificationQuickSetup from "@/components/NotificationQuickSetup";
import NotificationTypePanel from "@/components/NotificationTypePanel";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

const NotificationSettingsV2 = () => {
  const { t } = useTranslation();

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

  return (
    <Box className="flex-1 bg-grey dark:bg-slate-900">
      <TopBar title="settings.notification.title" href="/" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}>
        <VStack className="flex-1" space="md">
          {/* Master Toggle */}
          <Box className="bg-white dark:bg-slate-800 mx-4 mt-4 rounded-lg">
            <HStack className="p-4 justify-between items-center">
              <VStack className="flex-1">
                <Text className="text-left text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                onValueChange={updateAllNotificationToggle}
                size="lg"
                className="data-[state=checked]:bg-primary-500"
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

              {/* Prayer Notifications */}
              <NotificationTypePanel
                type={NOTIFICATION_TYPE.PRAYER}
                title={t("notification.prayerNotifications")}
                icon="Bell"
                iconColor="text-primary-600 dark:text-primary-400"
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
                iconColor="text-amber-600 dark:text-amber-400"
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
                iconColor="text-purple-600 dark:text-purple-400"
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
                <Box className="bg-blue-50 dark:bg-blue-900/20 mx-4 p-3 rounded-lg">
                  <HStack space="sm" className="items-center">
                    <Text className="text-sm text-blue-700 dark:text-blue-300">
                      {t("notification.schedulingNotifications")}...
                    </Text>
                  </HStack>
                </Box>
              )}
            </>
          )}

          {/* Debug/Test Section */}
          {__DEV__ && (
            <Box className="mx-4 mt-4">
              <Button variant="outline" size="sm" onPress={scheduleAllNotifications}>
                <ButtonText>Reschedule All Notifications</ButtonText>
              </Button>
            </Box>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default NotificationSettingsV2;

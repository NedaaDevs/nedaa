import React, { useState, useCallback, useEffect } from "react";
import { ScrollView, Platform, Linking, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import AlarmCard from "@/components/alarm/AlarmCard";
import AlarmSetupWizard from "@/components/alarm/AlarmSetupWizard";
import { AlarmClock, ShieldAlert, Settings, Clock } from "lucide-react-native";
import { useAlarmStore } from "@/stores/alarm";
import { useHaptic } from "@/hooks/useHaptic";
import { alarmKit, checkAlarmPermissions, requestAlarmPermissions } from "@/services/alarm";
import type { AlarmSettings, AlarmType } from "@/types/alarm";

type PermissionState = "loading" | "authorized" | "denied" | "notDetermined" | "unsupported";

export default function AlarmSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const hapticSelection = useHaptic("selection");

  const fajrAlarm = useAlarmStore((state) => state.fajrAlarm);
  const jummahAlarm = useAlarmStore((state) => state.jummahAlarm);
  const setFajrAlarmEnabled = useAlarmStore((state) => state.setFajrAlarmEnabled);
  const setJummahAlarmEnabled = useAlarmStore((state) => state.setJummahAlarmEnabled);
  const updateFajrAlarmSettings = useAlarmStore((state) => state.updateFajrAlarmSettings);
  const updateJummahAlarmSettings = useAlarmStore((state) => state.updateJummahAlarmSettings);
  const markSetupCompleted = useAlarmStore((state) => state.markSetupCompleted);

  const [permissionState, setPermissionState] = useState<PermissionState>("loading");
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [wizardType, setWizardType] = useState<AlarmType | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setPermissionState("loading");

    if (Platform.OS === "ios") {
      const status = await alarmKit.getAuthorizationStatus();
      if (status === "unsupported") {
        setPermissionState("unsupported");
      } else if (status === "authorized") {
        setPermissionState("authorized");
      } else if (status === "denied") {
        setPermissionState("denied");
      } else {
        setPermissionState("notDetermined");
      }
    } else if (Platform.OS === "android") {
      const permissions = await checkAlarmPermissions();
      if (permissions.notifications && permissions.exactAlarms && permissions.overlay) {
        setPermissionState("authorized");
      } else {
        setPermissionState("notDetermined");
      }
    }
  };

  const requestPermission = async () => {
    setIsRequestingPermission(true);

    try {
      if (Platform.OS === "ios") {
        const result = await alarmKit.requestAuthorization();
        if (result.status === "authorized") {
          setPermissionState("authorized");
        } else if (result.status === "denied") {
          setPermissionState("denied");
        }
      } else if (Platform.OS === "android") {
        const granted = await requestAlarmPermissions();
        if (granted) {
          setPermissionState("authorized");
        } else {
          await checkPermissions();
        }
      }
    } catch (error) {
      console.error("[AlarmSettings] Permission request error:", error);
      setPermissionState("denied");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const openAppSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const handleFajrToggle = useCallback(
    async (enabled: boolean) => {
      hapticSelection();
      if (enabled && !fajrAlarm.hasCompletedSetup) {
        setWizardType("fajr");
        setIsWizardOpen(true);
        return;
      }

      await setFajrAlarmEnabled(enabled);
    },
    [setFajrAlarmEnabled, hapticSelection, fajrAlarm.hasCompletedSetup]
  );

  const handleJummahToggle = useCallback(
    async (enabled: boolean) => {
      hapticSelection();
      if (enabled && !jummahAlarm.hasCompletedSetup) {
        setWizardType("jummah");
        setIsWizardOpen(true);
        return;
      }

      await setJummahAlarmEnabled(enabled);
    },
    [setJummahAlarmEnabled, hapticSelection, jummahAlarm.hasCompletedSetup]
  );

  const handleCardPress = useCallback(
    (type: AlarmType) => {
      hapticSelection();
      setWizardType(type);
      setIsWizardOpen(true);
    },
    [hapticSelection]
  );

  const handleEditPress = useCallback(
    (type: AlarmType) => {
      hapticSelection();
      router.push(`/settings/alarm/${type}`);
    },
    [hapticSelection, router]
  );

  const handleWizardComplete = useCallback(
    async (settings: Partial<AlarmSettings>) => {
      if (!wizardType) return;

      if (wizardType === "fajr") {
        await updateFajrAlarmSettings(settings);
        markSetupCompleted("fajr");
      } else {
        await updateJummahAlarmSettings(settings);
        markSetupCompleted("jummah");
      }

      setIsWizardOpen(false);
      setWizardType(null);
    },
    [wizardType, updateFajrAlarmSettings, updateJummahAlarmSettings, markSetupCompleted]
  );

  const handleWizardClose = useCallback(() => {
    setIsWizardOpen(false);
    setWizardType(null);
  }, []);

  const renderPermissionBanner = () => {
    if (permissionState === "loading") {
      return (
        <Card className="bg-background-secondary rounded-xl p-4 mb-4">
          <HStack className="items-center justify-center gap-3">
            <ActivityIndicator size="small" />
            <Text className="text-typography-secondary">
              {t("alarm.permission.checking", "Checking permissions...")}
            </Text>
          </HStack>
        </Card>
      );
    }

    if (permissionState === "unsupported") {
      return (
        <Card className="bg-background-error rounded-xl p-4 mb-4">
          <VStack className="gap-3">
            <HStack className="items-center gap-3">
              <Icon as={ShieldAlert} size="md" className="text-error" />
              <Text className="text-error font-semibold flex-1">
                {t("alarm.permission.unsupported", "Alarms Not Supported")}
              </Text>
            </HStack>
            <Text className="text-error text-sm">
              {Platform.OS === "ios"
                ? t(
                    "alarm.permission.requiresIOS26",
                    "Alarms require iOS 26 or later. Please update your device to use this feature."
                  )
                : t("alarm.permission.notAvailable", "Alarms are not available on this device.")}
            </Text>
          </VStack>
        </Card>
      );
    }

    if (permissionState === "notDetermined") {
      return (
        <Card className="bg-background-warning rounded-xl p-4 mb-4">
          <VStack className="gap-3">
            <HStack className="items-center gap-3">
              <Icon as={ShieldAlert} size="md" className="text-warning" />
              <Text className="text-warning font-semibold flex-1">
                {t("alarm.permission.required", "Permission Required")}
              </Text>
            </HStack>
            <Text className="text-warning text-sm">
              {t(
                "alarm.permission.description",
                "To use alarms, Nedaa needs permission to schedule notifications that can wake you up even when your phone is on silent or Do Not Disturb mode."
              )}
            </Text>
            <Button
              onPress={requestPermission}
              disabled={isRequestingPermission}
              className="bg-warning mt-2">
              {isRequestingPermission ? (
                <HStack className="items-center gap-2">
                  <ActivityIndicator size="small" color="white" />
                  <ButtonText>{t("alarm.permission.requesting", "Requesting...")}</ButtonText>
                </HStack>
              ) : (
                <ButtonText>{t("alarm.permission.grant", "Grant Permission")}</ButtonText>
              )}
            </Button>
          </VStack>
        </Card>
      );
    }

    if (permissionState === "denied") {
      return (
        <Card className="bg-background-error rounded-xl p-4 mb-4">
          <VStack className="gap-3">
            <HStack className="items-center gap-3">
              <Icon as={ShieldAlert} size="md" className="text-error" />
              <Text className="text-error font-semibold flex-1">
                {t("alarm.permission.denied", "Permission Denied")}
              </Text>
            </HStack>
            <Text className="text-error text-sm">
              {t(
                "alarm.permission.deniedDescription",
                "Alarm permission was denied. To enable alarms, please go to Settings and allow Nedaa to schedule alarms."
              )}
            </Text>
            <Button onPress={openAppSettings} className="bg-error mt-2">
              <HStack className="items-center gap-2">
                <Icon as={Settings} size="sm" className="text-white" />
                <ButtonText>{t("alarm.permission.openSettings", "Open Settings")}</ButtonText>
              </HStack>
            </Button>
          </VStack>
        </Card>
      );
    }

    return null;
  };

  return (
    <Background>
      <TopBar title={t("alarm.settings.title", "Alarm Settings")} href="/" backOnClick />
      <ScrollView
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Box className="mb-4">
          <HStack className="items-center gap-3 mb-2">
            <Icon as={AlarmClock} size="xl" className="text-primary" />
            <Text className="text-lg text-typography-secondary">
              {t("alarm.settings.description", "Set alarms for Fajr and Jummah prayers")}
            </Text>
          </HStack>
        </Box>

        {/* Permission Banner */}
        {renderPermissionBanner()}

        {/* Alarm Cards - Only show if permission is granted */}
        {permissionState === "authorized" && (
          <>
            {/* Fajr Alarm Card */}
            <AlarmCard
              type="fajr"
              settings={fajrAlarm}
              onToggle={handleFajrToggle}
              onPress={() => handleCardPress("fajr")}
              onEditPress={() => handleEditPress("fajr")}
            />

            {/* Jummah Alarm Card */}
            <AlarmCard
              type="jummah"
              settings={jummahAlarm}
              onToggle={handleJummahToggle}
              onPress={() => handleCardPress("jummah")}
              onEditPress={() => handleEditPress("jummah")}
            />
          </>
        )}
      </ScrollView>

      {/* Setup Wizard Modal */}
      {wizardType && (
        <AlarmSetupWizard
          isOpen={isWizardOpen}
          onClose={handleWizardClose}
          type={wizardType}
          onComplete={handleWizardComplete}
        />
      )}
    </Background>
  );
}

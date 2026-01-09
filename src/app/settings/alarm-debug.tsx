import { ScrollView, Platform } from "react-native";
import { useState, useEffect } from "react";

// Components
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";

// Expo Alarm Module
import * as ExpoAlarm from "expo-alarm";

const AlarmDebugScreen = () => {
  const [isModuleAvailable, setIsModuleAvailable] = useState<boolean | null>(null);
  const [isAlarmKitAvailable, setIsAlarmKitAvailable] = useState<boolean | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [scheduledAlarms, setScheduledAlarms] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [liveActivityId, setLiveActivityId] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    // Check if native module is available
    const moduleAvailable = ExpoAlarm.isNativeModuleAvailable();
    setIsModuleAvailable(moduleAvailable);

    if (moduleAvailable) {
      // Check AlarmKit availability
      const alarmKitAvailable = await ExpoAlarm.isAlarmKitAvailable();
      setIsAlarmKitAvailable(alarmKitAvailable);

      // Get auth status
      const status = await ExpoAlarm.getAuthorizationStatus();
      setAuthStatus(status);

      // Get scheduled alarms
      const alarms = await ExpoAlarm.getScheduledAlarmIds();
      setScheduledAlarms(alarms);
    }
  };

  const handleRequestAuth = async () => {
    try {
      const status = await ExpoAlarm.requestAuthorization();
      setAuthStatus(status);
      setLastResult(`Authorization: ${status}`);
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const scheduleTestAlarm = async (seconds: number) => {
    try {
      const id = `test-${Date.now()}`;
      const triggerDate = new Date(Date.now() + seconds * 1000);

      const success = await ExpoAlarm.scheduleAlarm({
        id,
        triggerDate,
        title: `Test Alarm (${seconds}s)`,
        alarmType: "fajr",
      });

      if (success) {
        setLastResult(`Scheduled alarm for ${triggerDate.toLocaleTimeString()}`);
        await checkStatus();
      } else {
        setLastResult("Failed to schedule alarm");
      }
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const refreshAlarmList = async () => {
    try {
      const alarms = await ExpoAlarm.getScheduledAlarmIds();
      setScheduledAlarms(alarms);
      setLastResult(`Found ${alarms.length} alarm(s)`);
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const handleCancelAll = async () => {
    try {
      await ExpoAlarm.cancelAllAlarms();
      setLastResult("Cancelled all alarms");
      await checkStatus();
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const getStatusColor = (value: boolean | null) => {
    if (value === null) return "warning";
    return value ? "success" : "error";
  };

  const handleStartLiveActivity = async (seconds: number) => {
    try {
      const triggerDate = new Date(Date.now() + seconds * 1000);
      const activityId = await ExpoAlarm.startLiveActivity({
        alarmId: `test-${Date.now()}`,
        alarmType: "fajr",
        title: `Fajr in ${seconds}s`,
        triggerDate,
      });
      if (activityId) {
        setLiveActivityId(activityId);
        setLastResult(`Live Activity started: ${activityId.slice(0, 8)}...`);
      } else {
        setLastResult("Live Activity not supported");
      }
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const handleEndLiveActivity = async () => {
    try {
      if (liveActivityId) {
        await ExpoAlarm.endLiveActivity(liveActivityId);
        setLiveActivityId(null);
        setLastResult("Live Activity ended");
      } else {
        await ExpoAlarm.endAllLiveActivities();
        setLastResult("All Live Activities ended");
      }
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  return (
    <Background>
      <TopBar title="Alarm Debug" href="/settings" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack className="flex-1 p-4" space="md">
          {/* Status Card */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Module Status</Text>

              <HStack className="justify-between items-center">
                <Text className="text-typography">Native Module</Text>
                <Badge action={getStatusColor(isModuleAvailable)}>
                  <BadgeText>{isModuleAvailable ? "Available" : "Not Available"}</BadgeText>
                </Badge>
              </HStack>

              <HStack className="justify-between items-center">
                <Text className="text-typography">AlarmKit (iOS 26+)</Text>
                <Badge action={getStatusColor(isAlarmKitAvailable)}>
                  <BadgeText>
                    {isAlarmKitAvailable === null
                      ? "Unknown"
                      : isAlarmKitAvailable
                        ? "Available"
                        : "Not Available"}
                  </BadgeText>
                </Badge>
              </HStack>

              <HStack className="justify-between items-center">
                <Text className="text-typography">Authorization</Text>
                <Badge
                  action={
                    authStatus === "authorized"
                      ? "success"
                      : authStatus === "denied"
                        ? "error"
                        : "warning"
                  }>
                  <BadgeText>{authStatus ?? "Unknown"}</BadgeText>
                </Badge>
              </HStack>

              <HStack className="justify-between items-center">
                <Text className="text-typography">Platform</Text>
                <Badge action="info">
                  <BadgeText>{Platform.OS}</BadgeText>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Authorization */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Authorization</Text>
              <Button onPress={handleRequestAuth}>
                <ButtonText>Request Authorization</ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Schedule Test Alarms */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Schedule Test Alarm</Text>

              <HStack space="sm" className="flex-wrap">
                {[10, 30, 60, 300, 600].map((seconds) => (
                  <Button
                    key={seconds}
                    size="sm"
                    variant="outline"
                    onPress={() => scheduleTestAlarm(seconds)}>
                    <ButtonText>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</ButtonText>
                  </Button>
                ))}
              </HStack>
            </VStack>
          </Card>

          {/* Live Activity Test */}
          <Card className="p-4">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">Live Activity</Text>
                {liveActivityId && (
                  <Badge action="success">
                    <BadgeText>Active</BadgeText>
                  </Badge>
                )}
              </HStack>

              <HStack space="sm" className="flex-wrap">
                {[30, 60, 300].map((seconds) => (
                  <Button
                    key={seconds}
                    size="sm"
                    variant="outline"
                    onPress={() => handleStartLiveActivity(seconds)}>
                    <ButtonText>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</ButtonText>
                  </Button>
                ))}
                <Button size="sm" variant="outline" onPress={handleEndLiveActivity}>
                  <ButtonText>End</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>

          {/* Scheduled Alarms */}
          <Card className="p-4">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">Scheduled Alarms</Text>
                <Badge action="info">
                  <BadgeText>{scheduledAlarms.length}</BadgeText>
                </Badge>
              </HStack>

              {scheduledAlarms.length > 0 ? (
                <VStack space="xs">
                  {scheduledAlarms.map((id) => (
                    <Text key={id} className="text-sm text-typography-secondary font-mono">
                      {id}
                    </Text>
                  ))}
                </VStack>
              ) : (
                <Text className="text-sm text-typography-secondary">No alarms scheduled</Text>
              )}

              <HStack space="sm">
                <Button variant="outline" className="flex-1" onPress={refreshAlarmList}>
                  <ButtonText>Refresh List</ButtonText>
                </Button>
                <Button variant="outline" className="flex-1" onPress={handleCancelAll}>
                  <ButtonText>Cancel All</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>

          {/* Last Result */}
          {lastResult && (
            <Card className="p-4 bg-background-muted">
              <VStack space="sm">
                <Text className="text-sm font-semibold text-typography">Last Result</Text>
                <Text className="text-sm text-typography-secondary">{lastResult}</Text>
              </VStack>
            </Card>
          )}

          {/* Refresh Button */}
          <Button variant="outline" onPress={checkStatus}>
            <ButtonText>Refresh Status</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmDebugScreen;

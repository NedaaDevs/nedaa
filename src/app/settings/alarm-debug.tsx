import { ScrollView, Platform, Share } from "react-native";
import { useState, useEffect } from "react";
import * as Crypto from "expo-crypto";

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

// Store
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Utils
import { schedulePrayerAlarm, getNextPrayerDate } from "@/utils/alarmScheduler";

const AlarmDebugScreen = () => {
  const [isModuleAvailable, setIsModuleAvailable] = useState<boolean | null>(null);
  const [isAlarmKitAvailable, setIsAlarmKitAvailable] = useState<boolean | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [bgRefreshStatus, setBgRefreshStatus] = useState<string | null>(null);
  const [nextAlarmTime, setNextAlarmTime] = useState<Date | null>(null);
  const [scheduledAlarms, setScheduledAlarms] = useState<string[]>([]);
  const [alarmKitAlarms, setAlarmKitAlarms] = useState<ExpoAlarm.AlarmKitAlarm[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [persistentLog, setPersistentLog] = useState<string>("");

  const { scheduleAlarm, cancelAllAlarms } = useAlarmStore();
  const { todayTimings } = usePrayerTimesStore();

  useEffect(() => {
    checkStatus();
  }, []);

  const fetchPersistentLog = () => {
    const log = ExpoAlarm.getPersistentLog();
    setPersistentLog(log);
    const lines = log.split("\n").filter((l) => l.trim()).length;
    setLastResult(`Loaded ${lines} lines from persistent log`);
  };

  const clearPersistentLog = () => {
    ExpoAlarm.clearPersistentLog();
    setPersistentLog("");
    setLastResult("Persistent log cleared");
  };

  const sharePersistentLog = async () => {
    const log = ExpoAlarm.getPersistentLog();
    if (log) {
      try {
        await Share.share({
          message: log,
          title: "Persistent Alarm Log",
        });
        setLastResult("Persistent log shared");
      } catch {
        setLastResult("Share failed");
      }
    } else {
      setLastResult("No log to share");
    }
  };

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

      // Get background refresh status
      const bgStatus = ExpoAlarm.getBackgroundRefreshStatus();
      setBgRefreshStatus(bgStatus);

      // Get next alarm time (for BGTask)
      const nextTime = ExpoAlarm.getNextAlarmTime();
      setNextAlarmTime(nextTime ? new Date(nextTime) : null);

      // Get scheduled alarms (module tracking)
      const alarms = await ExpoAlarm.getScheduledAlarmIds();
      setScheduledAlarms(alarms);

      // Get AlarmKit alarms (system level)
      const kitAlarms = await ExpoAlarm.getAlarmKitAlarms();
      setAlarmKitAlarms(kitAlarms);
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
      // AlarmKit requires valid UUIDs
      const id = Crypto.randomUUID();
      const triggerDate = new Date(Date.now() + seconds * 1000);

      // Use store's scheduleAlarm (includes backup + Live Activity)
      const success = await scheduleAlarm({
        id,
        triggerDate,
        title: `Test Alarm (${seconds}s)`,
        alarmType: "fajr",
      });

      if (success) {
        setLastResult(`Scheduled: alarm + backup + Live Activity`);
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

  const checkAlarmKitAlarms = async () => {
    try {
      const alarms = await ExpoAlarm.getAlarmKitAlarms();
      setAlarmKitAlarms(alarms);
      if (alarms.length === 0) {
        setLastResult("AlarmKit: No alarms scheduled at system level");
      } else {
        const alarmsInfo = alarms.map((a) => `${a.id.substring(0, 8)}... (${a.state})`).join(", ");
        setLastResult(`AlarmKit: ${alarms.length} alarm(s) - ${alarmsInfo}`);
      }
    } catch (error) {
      setLastResult(`AlarmKit Error: ${error}`);
    }
  };

  const handleCancelAll = async () => {
    try {
      // Use store's cancelAllAlarms (cancels alarms + backups + Live Activities)
      await cancelAllAlarms();
      setLastResult("Cancelled all alarms + backups + Live Activities");
      await checkStatus();
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const handleResetState = async () => {
    try {
      await ExpoAlarm.clearPendingChallenge();
      await ExpoAlarm.clearCompletedChallenges();
      await ExpoAlarm.endAllLiveActivities();
      await cancelAllAlarms();
      setLastResult("Reset: cleared pending, completed, Live Activities, and alarms");
      await checkStatus();
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const scheduleNextFajr = async () => {
    try {
      const alarmId = await schedulePrayerAlarm("fajr", "fajr");
      if (alarmId) {
        const nextFajr = getNextPrayerDate("fajr");
        setLastResult(`Scheduled Fajr: ${nextFajr?.toISOString()}`);
        await checkStatus();
      } else {
        setLastResult("Failed - no prayer times available");
      }
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const getStatusColor = (value: boolean | null) => {
    if (value === null) return "warning";
    return value ? "success" : "error";
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
                <Text className="text-typography">AlarmKit (iOS 26.1+)</Text>
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
                <Text className="text-typography">Background Refresh</Text>
                <Badge
                  action={
                    bgRefreshStatus === "available"
                      ? "success"
                      : bgRefreshStatus === "denied"
                        ? "error"
                        : bgRefreshStatus === "restricted"
                          ? "warning"
                          : "info"
                  }>
                  <BadgeText>{bgRefreshStatus ?? "Unknown"}</BadgeText>
                </Badge>
              </HStack>

              {nextAlarmTime && (
                <HStack className="justify-between items-center">
                  <Text className="text-typography">BGTask Wake</Text>
                  <Badge action="info">
                    <BadgeText>
                      {new Date(nextAlarmTime.getTime() - 60000).toLocaleTimeString()}
                    </BadgeText>
                  </Badge>
                </HStack>
              )}

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
                {[60, 180, 300, 600].map((seconds) => (
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

          {/* Prayer Time Alarm */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Prayer Time Alarm</Text>
              <Button onPress={scheduleNextFajr}>
                <ButtonText>Schedule Next Fajr</ButtonText>
              </Button>
              {todayTimings && (
                <Text className="text-sm text-typography-secondary">
                  Next Fajr: {getNextPrayerDate("fajr")?.toLocaleString() ?? "N/A"}
                </Text>
              )}
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

              <Button variant="outline" onPress={handleResetState}>
                <ButtonText>Reset All State (Debug)</ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* AlarmKit Verification (System Level) */}
          <Card className="p-4">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">AlarmKit (System)</Text>
                <Badge action="info">
                  <BadgeText>{alarmKitAlarms.length}</BadgeText>
                </Badge>
              </HStack>

              <Text className="text-xs text-typography-secondary">
                Shows alarms actually scheduled with AlarmKit at the system level. If empty after
                scheduling, the alarm won&apos;t fire when app is killed.
              </Text>

              {alarmKitAlarms.length > 0 ? (
                <VStack space="sm">
                  {alarmKitAlarms.map((alarm) => (
                    <VStack key={alarm.id} space="xs" className="p-2 bg-background-muted rounded">
                      <Text className="text-xs font-mono text-typography">
                        ID: {alarm.id.substring(0, 8)}...
                      </Text>
                      <HStack space="sm">
                        <Badge
                          action={
                            alarm.state === "scheduled"
                              ? "success"
                              : alarm.state === "alerting"
                                ? "warning"
                                : "info"
                          }
                          size="sm">
                          <BadgeText>{alarm.state}</BadgeText>
                        </Badge>
                        {alarm.scheduleType && (
                          <Badge action="info" size="sm">
                            <BadgeText>{alarm.scheduleType}</BadgeText>
                          </Badge>
                        )}
                      </HStack>
                      {alarm.triggerDate && (
                        <Text className="text-xs text-typography-secondary">
                          Trigger: {new Date(alarm.triggerDate).toLocaleString()}
                        </Text>
                      )}
                    </VStack>
                  ))}
                </VStack>
              ) : (
                <Text className="text-sm text-typography-secondary italic">
                  No AlarmKit alarms - tap Check to verify
                </Text>
              )}

              <Button variant="outline" onPress={checkAlarmKitAlarms}>
                <ButtonText>Check AlarmKit</ButtonText>
              </Button>
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

          {/* Persistent Log (survives app kills) */}
          {Platform.OS === "ios" && (
            <Card className="p-4 border-2 border-yellow-500">
              <VStack space="md">
                <HStack className="justify-between items-center">
                  <Text className="text-lg font-semibold text-typography">Persistent Log</Text>
                  <Badge action="warning">
                    <BadgeText>File-based</BadgeText>
                  </Badge>
                </HStack>

                <Text className="text-xs text-typography-secondary">
                  📁 Survives app kills. Shows what happened when app was in background.
                </Text>

                <HStack space="sm">
                  <Button size="sm" variant="solid" className="flex-1" onPress={fetchPersistentLog}>
                    <ButtonText>Load</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onPress={sharePersistentLog}>
                    <ButtonText>Share</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onPress={clearPersistentLog}>
                    <ButtonText>Clear</ButtonText>
                  </Button>
                </HStack>

                {persistentLog ? (
                  <ScrollView
                    style={{
                      height: 200,
                      backgroundColor: "rgba(255,200,0,0.1)",
                      borderRadius: 8,
                      padding: 8,
                    }}
                    nestedScrollEnabled>
                    <Text className="text-xs font-mono text-typography-secondary">
                      {persistentLog}
                    </Text>
                  </ScrollView>
                ) : (
                  <Text className="text-sm text-typography-secondary italic">
                    Tap &quot;Load Log&quot; to see native events
                  </Text>
                )}
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

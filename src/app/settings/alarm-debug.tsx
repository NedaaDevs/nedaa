import { ScrollView, Platform, Share } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { generateDeterministicUUID } from "@/utils/alarmId";

// Components
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";
import SoundPicker from "@/components/alarm/SoundPicker";

// Expo Alarm Module
import * as ExpoAlarm from "expo-alarm";

// Store
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";

// Types
import {
  ChallengeType,
  ChallengeDifficulty,
  VibrationPattern,
  CHALLENGE_TYPES,
  CHALLENGE_DIFFICULTIES,
  VIBRATION_PATTERNS,
} from "@/types/alarm";

// Utils
import { schedulePrayerAlarm, getNextPrayerDate } from "@/utils/alarmScheduler";
import { AlarmLogger } from "@/utils/alarmLogger";

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

  // Android-specific states
  const [isBatteryExempt, setIsBatteryExempt] = useState<boolean | null>(null);
  const [canFullScreen, setCanFullScreen] = useState<boolean | null>(null);
  const [canDrawOverlay, setCanDrawOverlay] = useState<boolean | null>(null);
  const [hasAutoStart, setHasAutoStart] = useState<boolean | null>(null);
  const [deviceManufacturer, setDeviceManufacturer] = useState<string>("");

  // Test alarm settings
  const [testChallengeType, setTestChallengeType] = useState<ChallengeType>("tap");
  const [testDifficulty, setTestDifficulty] = useState<ChallengeDifficulty>("easy");
  const [testChallengeCount, setTestChallengeCount] = useState<number>(1);
  const [testVibrationEnabled, setTestVibrationEnabled] = useState<boolean>(true);
  const [testVibrationPattern, setTestVibrationPattern] = useState<VibrationPattern>("default");
  const [testVolume, setTestVolume] = useState<number>(1.0);
  const [testSnoozeEnabled, setTestSnoozeEnabled] = useState<boolean>(true);
  const [testSound, setTestSound] = useState<string>("beep");

  const { scheduleAlarm, cancelAllAlarms } = useAlarmStore();
  const { fajr: fajrSettings, updateSettings } = useAlarmSettingsStore();
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

  const shareFullDebugLog = async () => {
    try {
      setLastResult("Generating full debug log...");
      await AlarmLogger.shareLog();
      setLastResult("Full debug log shared");
    } catch (e) {
      setLastResult(`Share failed: ${e}`);
    }
  };

  const copyFullDebugLog = async () => {
    try {
      setLastResult("Copying debug log...");
      const ok = await AlarmLogger.copyLog();
      setLastResult(ok ? "Debug log copied to clipboard" : "Failed to copy");
    } catch (e) {
      setLastResult(`Copy failed: ${e}`);
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

      // Android-specific checks
      if (Platform.OS === "android") {
        setIsBatteryExempt(ExpoAlarm.isBatteryOptimizationExempt());
        setCanFullScreen(ExpoAlarm.canUseFullScreenIntent());
        setCanDrawOverlay(ExpoAlarm.canDrawOverlays());
        setHasAutoStart(ExpoAlarm.hasAutoStartSettings());
        setDeviceManufacturer(ExpoAlarm.getDeviceManufacturer());
      }
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

  // Apply test settings to store before scheduling
  const applyTestSettings = () => {
    updateSettings("fajr", {
      sound: testSound,
      challenge: {
        type: testChallengeType,
        difficulty: testDifficulty,
        count: testChallengeCount as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      },
      vibration: {
        enabled: testVibrationEnabled,
        pattern: testVibrationPattern,
      },
      volume: testVolume,
      snooze: {
        ...fajrSettings.snooze,
        enabled: testSnoozeEnabled,
      },
    });
  };

  const scheduleTestAlarm = async (seconds: number) => {
    try {
      // Apply test settings to store first
      applyTestSettings();

      // AlarmKit requires valid UUIDs - use timestamp for debug alarms
      const id = generateDeterministicUUID(`debug_${Date.now()}`);
      const triggerDate = new Date(Date.now() + seconds * 1000);

      // Use store's scheduleAlarm (includes backup + Live Activity)
      const success = await scheduleAlarm({
        id,
        triggerDate,
        title: `Test Alarm (${seconds}s)`,
        alarmType: "fajr",
      });

      if (success) {
        setLastResult(
          `Scheduled with: sound=${testSound}, ${testChallengeType}/${testDifficulty}/${testChallengeCount}x, ` +
            `vib=${testVibrationEnabled ? testVibrationPattern : "off"}, vol=${Math.round(testVolume * 100)}%`
        );
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

          {/* Android Permissions */}
          {Platform.OS === "android" && (
            <Card className="p-4 border-2 border-orange-500">
              <VStack space="md">
                <Text className="text-lg font-semibold text-typography">Android Permissions</Text>

                <HStack className="justify-between items-center">
                  <Text className="text-typography">Battery Optimization</Text>
                  <Badge action={isBatteryExempt ? "success" : "error"}>
                    <BadgeText>{isBatteryExempt ? "Exempt" : "Not Exempt"}</BadgeText>
                  </Badge>
                </HStack>
                {!isBatteryExempt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      ExpoAlarm.requestBatteryOptimizationExemption();
                      setLastResult("Opened battery optimization settings");
                    }}>
                    <ButtonText>Request Exemption</ButtonText>
                  </Button>
                )}

                <HStack className="justify-between items-center">
                  <Text className="text-typography">Full Screen Intent</Text>
                  <Badge action={canFullScreen ? "success" : "error"}>
                    <BadgeText>{canFullScreen ? "Allowed" : "Denied"}</BadgeText>
                  </Badge>
                </HStack>
                {!canFullScreen && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      ExpoAlarm.requestFullScreenIntentPermission();
                      setLastResult("Opened full screen intent settings");
                    }}>
                    <ButtonText>Request Permission</ButtonText>
                  </Button>
                )}

                <HStack className="justify-between items-center">
                  <Text className="text-typography">Draw Over Apps</Text>
                  <Badge action={canDrawOverlay ? "success" : "error"}>
                    <BadgeText>{canDrawOverlay ? "Allowed" : "Denied"}</BadgeText>
                  </Badge>
                </HStack>
                {!canDrawOverlay && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      ExpoAlarm.requestDrawOverlaysPermission();
                      setLastResult("Opened draw over apps settings");
                    }}>
                    <ButtonText>Request Permission</ButtonText>
                  </Button>
                )}

                {hasAutoStart && (
                  <>
                    <HStack className="justify-between items-center">
                      <Text className="text-typography">Auto-Start ({deviceManufacturer})</Text>
                      <Badge action="warning">
                        <BadgeText>Check Settings</BadgeText>
                      </Badge>
                    </HStack>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        ExpoAlarm.openAutoStartSettings();
                        setLastResult(`Opened auto-start settings for ${deviceManufacturer}`);
                      }}>
                      <ButtonText>Open Auto-Start Settings</ButtonText>
                    </Button>
                  </>
                )}

                <Text className="text-xs text-typography-secondary">
                  For reliable alarms: exempt from battery optimization, allow full screen intent,
                  draw over apps (with challenge), and enable auto-start (OEM devices).
                </Text>
              </VStack>
            </Card>
          )}

          {/* Test Alarm Settings */}
          <Card className="p-4 border-2 border-purple-500">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">Test Settings</Text>
                <Badge action="info">
                  <BadgeText>Quick Config</BadgeText>
                </Badge>
              </HStack>

              <Text className="text-xs text-typography-secondary">
                Configure these settings, then schedule a test alarm below.
              </Text>

              {/* Sound */}
              <SoundPicker value={testSound} onChange={setTestSound} />

              {/* Challenge Type */}
              <VStack space="xs">
                <Text className="text-sm text-typography">Challenge Type</Text>
                <HStack space="sm">
                  {CHALLENGE_TYPES.map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={testChallengeType === type ? "solid" : "outline"}
                      onPress={() => setTestChallengeType(type)}
                      className="flex-1">
                      <ButtonText className="capitalize">{type}</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Challenge Difficulty */}
              <VStack space="xs">
                <Text className="text-sm text-typography">Difficulty</Text>
                <HStack space="sm">
                  {CHALLENGE_DIFFICULTIES.map((diff) => (
                    <Button
                      key={diff}
                      size="sm"
                      variant={testDifficulty === diff ? "solid" : "outline"}
                      onPress={() => setTestDifficulty(diff)}
                      className="flex-1">
                      <ButtonText className="capitalize">{diff}</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Challenge Count */}
              <VStack space="xs">
                <Text className="text-sm text-typography">
                  Challenge Count: {testChallengeCount}
                </Text>
                <HStack space="sm">
                  {[1, 2, 3, 5, 10].map((count) => (
                    <Button
                      key={count}
                      size="sm"
                      variant={testChallengeCount === count ? "solid" : "outline"}
                      onPress={() => setTestChallengeCount(count)}
                      className="flex-1">
                      <ButtonText>{count}</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Vibration */}
              <VStack space="xs">
                <HStack className="justify-between items-center">
                  <Text className="text-sm text-typography">Vibration</Text>
                  <Switch
                    size="sm"
                    value={testVibrationEnabled}
                    onValueChange={setTestVibrationEnabled}
                  />
                </HStack>
                {testVibrationEnabled && (
                  <HStack space="sm">
                    {(Object.keys(VIBRATION_PATTERNS) as VibrationPattern[]).map((pattern) => (
                      <Button
                        key={pattern}
                        size="sm"
                        variant={testVibrationPattern === pattern ? "solid" : "outline"}
                        onPress={() => setTestVibrationPattern(pattern)}
                        className="flex-1">
                        <ButtonText className="capitalize text-xs">{pattern}</ButtonText>
                      </Button>
                    ))}
                  </HStack>
                )}
              </VStack>

              {/* Volume */}
              <VStack space="xs">
                <Text className="text-sm text-typography">
                  Volume: {Math.round(testVolume * 100)}%
                </Text>
                <HStack space="sm">
                  {[0, 0.25, 0.5, 0.75, 1.0].map((vol) => (
                    <Button
                      key={vol}
                      size="sm"
                      variant={testVolume === vol ? "solid" : "outline"}
                      onPress={() => setTestVolume(vol)}
                      className="flex-1">
                      <ButtonText>{Math.round(vol * 100)}%</ButtonText>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Snooze */}
              <HStack className="justify-between items-center">
                <Text className="text-sm text-typography">Snooze Enabled</Text>
                <Switch size="sm" value={testSnoozeEnabled} onValueChange={setTestSnoozeEnabled} />
              </HStack>
            </VStack>
          </Card>

          {/* Schedule Test Alarms */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Schedule Test Alarm</Text>

              <Text className="text-xs text-typography-secondary">
                Uses settings above. Short times for quick testing.
              </Text>

              <HStack space="sm" className="flex-wrap">
                {[10, 30, 60, 180].map((seconds) => (
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

          {/* Test Success Screen */}
          <Card className="p-4">
            <VStack space="md">
              <Text className="text-lg font-semibold text-typography">Success Screen</Text>
              <HStack space="sm">
                {(["fajr", "jummah", "custom"] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onPress={() => router.push(`/alarm-complete?alarmType=${type}`)}>
                    <ButtonText className="capitalize">{type}</ButtonText>
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

          {/* Full Debug Log Export */}
          <Card className="p-4 border-2 border-blue-500">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">Debug Log Export</Text>
                <Badge action="info">
                  <BadgeText>Full</BadgeText>
                </Badge>
              </HStack>

              <Text className="text-xs text-typography-secondary">
                Exports native + React Native logs, device info, permissions, and alarm state.
              </Text>

              <HStack space="sm">
                <Button variant="solid" className="flex-1" onPress={shareFullDebugLog}>
                  <ButtonText>Share</ButtonText>
                </Button>
                <Button variant="outline" className="flex-1" onPress={copyFullDebugLog}>
                  <ButtonText>Copy</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>

          {/* Persistent Log (survives app kills) */}
          <Card className="p-4 border-2 border-yellow-500">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <Text className="text-lg font-semibold text-typography">Native Log</Text>
                <Badge action="warning">
                  <BadgeText>File-based</BadgeText>
                </Badge>
              </HStack>

              <Text className="text-xs text-typography-secondary">
                Survives app kills. Shows what happened in native code.
              </Text>

              <HStack space="sm">
                <Button size="sm" variant="solid" className="flex-1" onPress={fetchPersistentLog}>
                  <ButtonText>Load</ButtonText>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onPress={sharePersistentLog}>
                  <ButtonText>Share</ButtonText>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onPress={clearPersistentLog}>
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
                  Tap &quot;Load&quot; to see native events
                </Text>
              )}
            </VStack>
          </Card>

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

import { ScrollView, Platform, Share } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { generateDeterministicUUID } from "@/utils/alarmId";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";
import SoundPicker from "@/components/alarm/SoundPicker";

import * as ExpoAlarm from "expo-alarm";

import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";

import {
  ChallengeType,
  ChallengeDifficulty,
  VibrationPattern,
  CHALLENGE_TYPES,
  CHALLENGE_DIFFICULTIES,
  VIBRATION_PATTERNS,
} from "@/types/alarm";

import { schedulePrayerAlarm, getNextPrayerDate } from "@/utils/alarmScheduler";
import { shareAlarmReport, copyAlarmReport } from "@/utils/alarmReport";

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

  const [isBatteryExempt, setIsBatteryExempt] = useState<boolean | null>(null);
  const [canFullScreen, setCanFullScreen] = useState<boolean | null>(null);
  const [canDrawOverlay, setCanDrawOverlay] = useState<boolean | null>(null);
  const [hasAutoStart, setHasAutoStart] = useState<boolean | null>(null);
  const [deviceManufacturer, setDeviceManufacturer] = useState<string>("");

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
      await shareAlarmReport();
      setLastResult("Full debug log shared");
    } catch (e) {
      setLastResult(`Share failed: ${e}`);
    }
  };

  const copyFullDebugLog = async () => {
    try {
      setLastResult("Copying debug log...");
      const ok = await copyAlarmReport();
      setLastResult(ok ? "Debug log copied to clipboard" : "Failed to copy");
    } catch (e) {
      setLastResult(`Copy failed: ${e}`);
    }
  };

  const checkStatus = async () => {
    const moduleAvailable = ExpoAlarm.isNativeModuleAvailable();
    setIsModuleAvailable(moduleAvailable);

    if (moduleAvailable) {
      const alarmKitAvailable = await ExpoAlarm.isAlarmKitAvailable();
      setIsAlarmKitAvailable(alarmKitAvailable);

      const status = await ExpoAlarm.getAuthorizationStatus();
      setAuthStatus(status);

      const bgStatus = ExpoAlarm.getBackgroundRefreshStatus();
      setBgRefreshStatus(bgStatus);

      const nextTime = ExpoAlarm.getNextAlarmTime();
      setNextAlarmTime(nextTime ? new Date(nextTime) : null);

      const alarms = await ExpoAlarm.getScheduledAlarmIds();
      setScheduledAlarms(alarms);

      const kitAlarms = await ExpoAlarm.getAlarmKitAlarms();
      setAlarmKitAlarms(kitAlarms);

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
      applyTestSettings();

      const id = generateDeterministicUUID(`debug_${Date.now()}`);
      const triggerDate = new Date(Date.now() + seconds * 1000);

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
        <VStack flex={1} padding="$4" gap="$3">
          {/* Status Card */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Module Status
              </Text>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Native Module</Text>
                <Badge action={getStatusColor(isModuleAvailable)}>
                  <Badge.Text>{isModuleAvailable ? "Available" : "Not Available"}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">AlarmKit (iOS 26.1+)</Text>
                <Badge action={getStatusColor(isAlarmKitAvailable)}>
                  <Badge.Text>
                    {isAlarmKitAvailable === null
                      ? "Unknown"
                      : isAlarmKitAvailable
                        ? "Available"
                        : "Not Available"}
                  </Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Authorization</Text>
                <Badge
                  action={
                    authStatus === "authorized"
                      ? "success"
                      : authStatus === "denied"
                        ? "error"
                        : "warning"
                  }>
                  <Badge.Text>{authStatus ?? "Unknown"}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Background Refresh</Text>
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
                  <Badge.Text>{bgRefreshStatus ?? "Unknown"}</Badge.Text>
                </Badge>
              </HStack>

              {nextAlarmTime && (
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="$typography">BGTask Wake</Text>
                  <Badge action="info">
                    <Badge.Text>
                      {new Date(nextAlarmTime.getTime() - 60000).toLocaleTimeString()}
                    </Badge.Text>
                  </Badge>
                </HStack>
              )}

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Platform</Text>
                <Badge action="info">
                  <Badge.Text>{Platform.OS}</Badge.Text>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Authorization */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Authorization
              </Text>
              <Button onPress={handleRequestAuth}>
                <Button.Text>Request Authorization</Button.Text>
              </Button>
            </VStack>
          </Card>

          {/* Android Permissions */}
          {Platform.OS === "android" && (
            <Card padding="$4" borderWidth={2} borderColor="$warning">
              <VStack gap="$3">
                <Text size="lg" fontWeight="600" color="$typography">
                  Android Permissions
                </Text>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="$typography">Battery Optimization</Text>
                  <Badge action={isBatteryExempt ? "success" : "error"}>
                    <Badge.Text>{isBatteryExempt ? "Exempt" : "Not Exempt"}</Badge.Text>
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
                    <Button.Text>Request Exemption</Button.Text>
                  </Button>
                )}

                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="$typography">Full Screen Intent</Text>
                  <Badge action={canFullScreen ? "success" : "error"}>
                    <Badge.Text>{canFullScreen ? "Allowed" : "Denied"}</Badge.Text>
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
                    <Button.Text>Request Permission</Button.Text>
                  </Button>
                )}

                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="$typography">Draw Over Apps</Text>
                  <Badge action={canDrawOverlay ? "success" : "error"}>
                    <Badge.Text>{canDrawOverlay ? "Allowed" : "Denied"}</Badge.Text>
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
                    <Button.Text>Request Permission</Button.Text>
                  </Button>
                )}

                {hasAutoStart && (
                  <>
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text color="$typography">Auto-Start ({deviceManufacturer})</Text>
                      <Badge action="warning">
                        <Badge.Text>Check Settings</Badge.Text>
                      </Badge>
                    </HStack>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        ExpoAlarm.openAutoStartSettings();
                        setLastResult(`Opened auto-start settings for ${deviceManufacturer}`);
                      }}>
                      <Button.Text>Open Auto-Start Settings</Button.Text>
                    </Button>
                  </>
                )}

                <Text size="xs" color="$typographySecondary">
                  For reliable alarms: exempt from battery optimization, allow full screen intent,
                  draw over apps (with challenge), and enable auto-start (OEM devices).
                </Text>
              </VStack>
            </Card>
          )}

          {/* Test Alarm Settings */}
          <Card padding="$4" borderWidth={2} borderColor="$primary">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Test Settings
                </Text>
                <Badge action="info">
                  <Badge.Text>Quick Config</Badge.Text>
                </Badge>
              </HStack>

              <Text size="xs" color="$typographySecondary">
                Configure these settings, then schedule a test alarm below.
              </Text>

              {/* Sound */}
              <SoundPicker value={testSound} onChange={setTestSound} />

              {/* Challenge Type */}
              <VStack gap="$1">
                <Text size="sm" color="$typography">
                  Challenge Type
                </Text>
                <HStack gap="$2">
                  {CHALLENGE_TYPES.map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={testChallengeType === type ? "solid" : "outline"}
                      onPress={() => setTestChallengeType(type)}
                      flex={1}>
                      <Button.Text textTransform="capitalize">{type}</Button.Text>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Challenge Difficulty */}
              <VStack gap="$1">
                <Text size="sm" color="$typography">
                  Difficulty
                </Text>
                <HStack gap="$2">
                  {CHALLENGE_DIFFICULTIES.map((diff) => (
                    <Button
                      key={diff}
                      size="sm"
                      variant={testDifficulty === diff ? "solid" : "outline"}
                      onPress={() => setTestDifficulty(diff)}
                      flex={1}>
                      <Button.Text textTransform="capitalize">{diff}</Button.Text>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Challenge Count */}
              <VStack gap="$1">
                <Text size="sm" color="$typography">
                  Challenge Count: {testChallengeCount}
                </Text>
                <HStack gap="$2">
                  {[1, 2, 3, 5, 10].map((count) => (
                    <Button
                      key={count}
                      size="sm"
                      variant={testChallengeCount === count ? "solid" : "outline"}
                      onPress={() => setTestChallengeCount(count)}
                      flex={1}>
                      <Button.Text>{count}</Button.Text>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Vibration */}
              <VStack gap="$1">
                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm" color="$typography">
                    Vibration
                  </Text>
                  <Switch
                    size="sm"
                    value={testVibrationEnabled}
                    onValueChange={setTestVibrationEnabled}
                  />
                </HStack>
                {testVibrationEnabled && (
                  <HStack gap="$2">
                    {(Object.keys(VIBRATION_PATTERNS) as VibrationPattern[]).map((pattern) => (
                      <Button
                        key={pattern}
                        size="sm"
                        variant={testVibrationPattern === pattern ? "solid" : "outline"}
                        onPress={() => setTestVibrationPattern(pattern)}
                        flex={1}>
                        <Button.Text textTransform="capitalize" fontSize={10}>
                          {pattern}
                        </Button.Text>
                      </Button>
                    ))}
                  </HStack>
                )}
              </VStack>

              {/* Volume */}
              <VStack gap="$1">
                <Text size="sm" color="$typography">
                  Volume: {Math.round(testVolume * 100)}%
                </Text>
                <HStack gap="$2">
                  {[0, 0.25, 0.5, 0.75, 1.0].map((vol) => (
                    <Button
                      key={vol}
                      size="sm"
                      variant={testVolume === vol ? "solid" : "outline"}
                      onPress={() => setTestVolume(vol)}
                      flex={1}>
                      <Button.Text>{Math.round(vol * 100)}%</Button.Text>
                    </Button>
                  ))}
                </HStack>
              </VStack>

              {/* Snooze */}
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="sm" color="$typography">
                  Snooze Enabled
                </Text>
                <Switch size="sm" value={testSnoozeEnabled} onValueChange={setTestSnoozeEnabled} />
              </HStack>
            </VStack>
          </Card>

          {/* Schedule Test Alarms */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Schedule Test Alarm
              </Text>

              <Text size="xs" color="$typographySecondary">
                Uses settings above. Short times for quick testing.
              </Text>

              <HStack gap="$2" flexWrap="wrap">
                {[10, 30, 60, 180].map((seconds) => (
                  <Button
                    key={seconds}
                    size="sm"
                    variant="outline"
                    onPress={() => scheduleTestAlarm(seconds)}>
                    <Button.Text>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</Button.Text>
                  </Button>
                ))}
              </HStack>
            </VStack>
          </Card>

          {/* Test Success Screen */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Success Screen
              </Text>
              <HStack gap="$2">
                {(["fajr", "jummah", "custom"] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    flex={1}
                    onPress={() => router.push(`/alarm-complete?alarmType=${type}`)}>
                    <Button.Text textTransform="capitalize">{type}</Button.Text>
                  </Button>
                ))}
              </HStack>
            </VStack>
          </Card>

          {/* Prayer Time Alarm */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Prayer Time Alarm
              </Text>
              <Button onPress={scheduleNextFajr}>
                <Button.Text>Schedule Next Fajr</Button.Text>
              </Button>
              {todayTimings && (
                <Text size="sm" color="$typographySecondary">
                  Next Fajr: {getNextPrayerDate("fajr")?.toLocaleString() ?? "N/A"}
                </Text>
              )}
            </VStack>
          </Card>

          {/* Scheduled Alarms */}
          <Card padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Scheduled Alarms
                </Text>
                <Badge action="info">
                  <Badge.Text>{scheduledAlarms.length}</Badge.Text>
                </Badge>
              </HStack>

              {scheduledAlarms.length > 0 ? (
                <VStack gap="$1">
                  {scheduledAlarms.map((id) => (
                    <Text key={id} size="sm" color="$typographySecondary" fontFamily="$mono">
                      {id}
                    </Text>
                  ))}
                </VStack>
              ) : (
                <Text size="sm" color="$typographySecondary">
                  No alarms scheduled
                </Text>
              )}

              <HStack gap="$2">
                <Button variant="outline" flex={1} onPress={refreshAlarmList}>
                  <Button.Text>Refresh List</Button.Text>
                </Button>
                <Button variant="outline" flex={1} onPress={handleCancelAll}>
                  <Button.Text>Cancel All</Button.Text>
                </Button>
              </HStack>

              <Button variant="outline" onPress={handleResetState}>
                <Button.Text>Reset All State (Debug)</Button.Text>
              </Button>
            </VStack>
          </Card>

          {/* AlarmKit Verification (System Level) */}
          <Card padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  AlarmKit (System)
                </Text>
                <Badge action="info">
                  <Badge.Text>{alarmKitAlarms.length}</Badge.Text>
                </Badge>
              </HStack>

              <Text size="xs" color="$typographySecondary">
                Shows alarms actually scheduled with AlarmKit at the system level. If empty after
                scheduling, the alarm won&apos;t fire when app is killed.
              </Text>

              {alarmKitAlarms.length > 0 ? (
                <VStack gap="$2">
                  {alarmKitAlarms.map((alarm) => (
                    <VStack
                      key={alarm.id}
                      gap="$1"
                      padding="$2"
                      backgroundColor="$backgroundMuted"
                      borderRadius="$2">
                      <Text size="xs" fontFamily="$mono" color="$typography">
                        ID: {alarm.id.substring(0, 8)}...
                      </Text>
                      <HStack gap="$2">
                        <Badge
                          action={
                            alarm.state === "scheduled"
                              ? "success"
                              : alarm.state === "alerting"
                                ? "warning"
                                : "info"
                          }
                          size="sm">
                          <Badge.Text>{alarm.state}</Badge.Text>
                        </Badge>
                        {alarm.scheduleType && (
                          <Badge action="info" size="sm">
                            <Badge.Text>{alarm.scheduleType}</Badge.Text>
                          </Badge>
                        )}
                      </HStack>
                      {alarm.triggerDate && (
                        <Text size="xs" color="$typographySecondary">
                          Trigger: {new Date(alarm.triggerDate).toLocaleString()}
                        </Text>
                      )}
                    </VStack>
                  ))}
                </VStack>
              ) : (
                <Text size="sm" color="$typographySecondary" fontStyle="italic">
                  No AlarmKit alarms - tap Check to verify
                </Text>
              )}

              <Button variant="outline" onPress={checkAlarmKitAlarms}>
                <Button.Text>Check AlarmKit</Button.Text>
              </Button>
            </VStack>
          </Card>

          {/* Last Result */}
          {lastResult && (
            <Card padding="$4" backgroundColor="$backgroundMuted">
              <VStack gap="$2">
                <Text size="sm" fontWeight="600" color="$typography">
                  Last Result
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {lastResult}
                </Text>
              </VStack>
            </Card>
          )}

          {/* Full Debug Log Export */}
          <Card padding="$4" borderWidth={2} borderColor="$info">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Debug Log Export
                </Text>
                <Badge action="info">
                  <Badge.Text>Full</Badge.Text>
                </Badge>
              </HStack>

              <Text size="xs" color="$typographySecondary">
                Exports native + React Native logs, device info, permissions, and alarm state.
              </Text>

              <HStack gap="$2">
                <Button variant="solid" flex={1} onPress={shareFullDebugLog}>
                  <Button.Text>Share</Button.Text>
                </Button>
                <Button variant="outline" flex={1} onPress={copyFullDebugLog}>
                  <Button.Text>Copy</Button.Text>
                </Button>
              </HStack>
            </VStack>
          </Card>

          {/* Persistent Log (survives app kills) */}
          <Card padding="$4" borderWidth={2} borderColor="$warning">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Native Log
                </Text>
                <Badge action="warning">
                  <Badge.Text>File-based</Badge.Text>
                </Badge>
              </HStack>

              <Text size="xs" color="$typographySecondary">
                Survives app kills. Shows what happened in native code.
              </Text>

              <HStack gap="$2">
                <Button size="sm" variant="solid" flex={1} onPress={fetchPersistentLog}>
                  <Button.Text>Load</Button.Text>
                </Button>
                <Button size="sm" variant="outline" flex={1} onPress={sharePersistentLog}>
                  <Button.Text>Share</Button.Text>
                </Button>
                <Button size="sm" variant="outline" flex={1} onPress={clearPersistentLog}>
                  <Button.Text>Clear</Button.Text>
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
                  <Text size="xs" fontFamily="$mono" color="$typographySecondary">
                    {persistentLog}
                  </Text>
                </ScrollView>
              ) : (
                <Text size="sm" color="$typographySecondary" fontStyle="italic">
                  Tap &quot;Load&quot; to see native events
                </Text>
              )}
            </VStack>
          </Card>

          {/* Refresh Button */}
          <Button variant="outline" onPress={checkStatus}>
            <Button.Text>Refresh Status</Button.Text>
          </Button>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmDebugScreen;

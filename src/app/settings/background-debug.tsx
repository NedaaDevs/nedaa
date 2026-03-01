import { ScrollView } from "react-native";
import { useState, useEffect, useCallback } from "react";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";

import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { BackgroundTaskLog, type TaskLogEntry } from "@/services/background-task-log";
import {
  BACKGROUND_REFRESH_TASK,
  registerBackgroundRefresh,
  unregisterBackgroundRefresh,
} from "@/tasks/backgroundRefresh";

const resultBadgeAction = (result: TaskLogEntry["result"]) => {
  switch (result) {
    case "success":
      return "success";
    case "failed":
      return "error";
    case "skipped":
      return "warning";
  }
};

const formatTimestamp = (iso: string): string => {
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const BackgroundDebugScreen = () => {
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<TaskLogEntry[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const status = await BackgroundTask.getStatusAsync();
      const statusLabels: Record<number, string> = {
        [BackgroundTask.BackgroundTaskStatus.Available]: "available",
        [BackgroundTask.BackgroundTaskStatus.Restricted]: "restricted",
      };
      setBgStatus(statusLabels[status] ?? `unknown (${status})`);
    } catch {
      setBgStatus("error");
    }

    try {
      const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
      setIsRegistered(registered);
    } catch {
      setIsRegistered(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const entries = await BackgroundTaskLog.getRecentLogs(50);
    setLogs(entries);
  }, []);

  useEffect(() => {
    checkStatus();
    loadLogs();
  }, [checkStatus, loadLogs]);

  const handleToggleRegistration = async () => {
    try {
      if (isRegistered) {
        await unregisterBackgroundRefresh();
        setLastResult("Task unregistered");
      } else {
        const success = await registerBackgroundRefresh();
        setLastResult(success ? "Task registered" : "Registration failed");
      }
      await checkStatus();
    } catch (error) {
      setLastResult(`Error: ${error}`);
    }
  };

  const handleClearLogs = async () => {
    await BackgroundTaskLog.clearLogs();
    setLogs([]);
    setLastResult("Logs cleared");
  };

  const handleRefresh = async () => {
    await checkStatus();
    await loadLogs();
    setLastResult("Refreshed");
  };

  return (
    <Background>
      <TopBar title="Background Debug" href="/settings" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} padding="$4" gap="$3">
          {/* Status Card */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Background Task Status
              </Text>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Service Availability</Text>
                <Badge
                  action={
                    bgStatus === "available"
                      ? "success"
                      : bgStatus === "restricted"
                        ? "warning"
                        : "info"
                  }>
                  <Badge.Text>{bgStatus ?? "Checking..."}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Task Registered</Text>
                <Badge
                  action={isRegistered === null ? "info" : isRegistered ? "success" : "warning"}>
                  <Badge.Text>
                    {isRegistered === null
                      ? "Checking..."
                      : isRegistered
                        ? "Registered"
                        : "Not Registered"}
                  </Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Task Name</Text>
                <Badge action="info">
                  <Badge.Text>{BACKGROUND_REFRESH_TASK.split(".").pop()}</Badge.Text>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Controls */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Controls
              </Text>

              <HStack gap="$2">
                <Button
                  flex={1}
                  variant={isRegistered ? "outline" : "solid"}
                  onPress={handleToggleRegistration}>
                  <Button.Text>{isRegistered ? "Unregister" : "Register"}</Button.Text>
                </Button>
                <Button variant="outline" flex={1} onPress={handleClearLogs}>
                  <Button.Text>Clear Logs</Button.Text>
                </Button>
              </HStack>

              <Button variant="outline" onPress={handleRefresh}>
                <Button.Text>Refresh Status</Button.Text>
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

          {/* Log List */}
          <Card padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Task Logs
                </Text>
                <Badge action="info">
                  <Badge.Text>{logs.length}</Badge.Text>
                </Badge>
              </HStack>

              {logs.length > 0 ? (
                <VStack gap="$2">
                  {logs.map((entry) => (
                    <VStack
                      key={entry.id}
                      gap="$1"
                      padding="$2"
                      backgroundColor="$backgroundMuted"
                      borderRadius="$2">
                      <HStack justifyContent="space-between" alignItems="center">
                        <Text size="xs" color="$typographySecondary">
                          {formatTimestamp(entry.timestamp)}
                        </Text>
                        <Badge action={resultBadgeAction(entry.result)} size="sm">
                          <Badge.Text>{entry.result}</Badge.Text>
                        </Badge>
                      </HStack>

                      <Text size="sm" fontWeight="600" color="$typography">
                        {entry.action}
                      </Text>

                      {entry.details && (
                        <Text size="xs" color="$typographySecondary">
                          {entry.details}
                        </Text>
                      )}

                      {entry.duration_ms != null && (
                        <Text size="xs" color="$typographySecondary">
                          Duration: {entry.duration_ms}ms
                        </Text>
                      )}
                    </VStack>
                  ))}
                </VStack>
              ) : (
                <Text size="sm" color="$typographySecondary" fontStyle="italic">
                  No log entries yet
                </Text>
              )}
            </VStack>
          </Card>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default BackgroundDebugScreen;

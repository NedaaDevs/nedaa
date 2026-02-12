import * as ExpoAlarm from "expo-alarm";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";

interface LogEntry {
  timestamp: number;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  tag: string;
  message: string;
}

const MAX_ENTRIES = 300;
const logs: LogEntry[] = [];

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toISOString().replace("T", " ").replace("Z", "");
}

function addLog(level: LogEntry["level"], tag: string, message: string) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    tag,
    message,
  };
  logs.push(entry);

  // Trim old entries
  while (logs.length > MAX_ENTRIES) {
    logs.shift();
  }

  // Also log to console
  const prefix = `[${tag}]`;
  switch (level) {
    case "DEBUG":
      console.debug(prefix, message);
      break;
    case "INFO":
      console.info(prefix, message);
      break;
    case "WARN":
      console.warn(prefix, message);
      break;
    case "ERROR":
      console.error(prefix, message);
      break;
  }
}

export const ISSUE_CATEGORIES = [
  "alarm_not_firing",
  "wrong_time",
  "no_sound",
  "cant_dismiss",
  "other",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const AlarmLogger = {
  d: (tag: string, message: string) => addLog("DEBUG", tag, message),
  i: (tag: string, message: string) => addLog("INFO", tag, message),
  w: (tag: string, message: string) => addLog("WARN", tag, message),
  e: (tag: string, message: string, error?: Error) => {
    const fullMessage = error ? `${message}: ${error.message}\n${error.stack}` : message;
    addLog("ERROR", tag, fullMessage);
  },

  getLogs: () => [...logs],

  getLogsAsString: () => {
    return logs
      .map(
        (entry) =>
          `${formatTimestamp(entry.timestamp)} [${entry.level}] ${entry.tag}: ${entry.message}`
      )
      .join("\n");
  },

  clear: () => {
    logs.length = 0;
  },

  async getFullDebugLog(category?: IssueCategory): Promise<string> {
    const sections: string[] = [];

    const appVersion = Application.nativeApplicationVersion ?? "unknown";
    const buildNumber = Application.nativeBuildVersion ?? "unknown";
    const deviceModel = Device.modelName ?? "unknown";
    const deviceBrand = Device.brand ?? "";
    const osVersion = Device.osVersion ?? "unknown";

    sections.push("=== NEDAA ALARM DIAGNOSTIC REPORT ===");
    sections.push(`Generated: ${new Date().toISOString()}`);
    if (category) {
      sections.push(`Issue: ${category}`);
    }
    sections.push("");

    sections.push("--- App & Device ---");
    sections.push(`App Version: ${appVersion} (${buildNumber})`);
    sections.push(`Device: ${deviceBrand} ${deviceModel}`);
    sections.push(`OS: ${Platform.OS} ${osVersion}`);
    sections.push(`Native Module: ${ExpoAlarm.isNativeModuleAvailable()}`);
    sections.push("");

    // Permission status
    try {
      const authStatus = await ExpoAlarm.getAuthorizationStatus();
      sections.push("--- Permissions ---");
      sections.push(`Authorization: ${authStatus}`);
      if (Platform.OS === "android") {
        sections.push(`Battery Exempt: ${ExpoAlarm.isBatteryOptimizationExempt()}`);
        sections.push(`Full Screen: ${ExpoAlarm.canUseFullScreenIntent()}`);
      }
      sections.push("");
    } catch (e) {
      sections.push(`--- Permissions (error: ${e}) ---`);
      sections.push("");
    }

    // Scheduled alarms
    try {
      const alarmIds = await ExpoAlarm.getScheduledAlarmIds();
      sections.push("--- Scheduled Alarms ---");
      sections.push(`Count: ${alarmIds.length}`);
      sections.push(`IDs: ${alarmIds.join(", ") || "(none)"}`);
      const nextAlarmTime = ExpoAlarm.getNextAlarmTime();
      if (nextAlarmTime) {
        sections.push(`Next Alarm: ${new Date(nextAlarmTime).toISOString()}`);
      }
      sections.push("");
    } catch (e) {
      sections.push(`--- Scheduled Alarms (error: ${e}) ---`);
      sections.push("");
    }

    // Pending challenge
    try {
      const pending = await ExpoAlarm.getPendingChallenge();
      sections.push("--- Pending Challenge ---");
      if (pending) {
        sections.push(`Alarm ID: ${pending.alarmId}`);
        sections.push(`Type: ${pending.alarmType}`);
        sections.push(`Title: ${pending.title}`);
        sections.push(`Timestamp: ${new Date(pending.timestamp).toISOString()}`);
      } else {
        sections.push("(none)");
      }
      sections.push("");
    } catch (e) {
      sections.push(`--- Pending Challenge (error: ${e}) ---`);
      sections.push("");
    }

    // Native logs
    sections.push("--- Native Logs ---");
    try {
      const nativeLog = ExpoAlarm.getPersistentLog();
      sections.push(nativeLog || "(empty)");
    } catch (e) {
      sections.push(`(error: ${e})`);
    }
    sections.push("");

    // React Native logs
    sections.push("--- React Native Logs ---");
    sections.push(this.getLogsAsString() || "(empty)");
    sections.push("");

    return sections.join("\n");
  },

  async getSummary(category: IssueCategory): Promise<string> {
    const appVersion = Application.nativeApplicationVersion ?? "unknown";
    const buildNumber = Application.nativeBuildVersion ?? "unknown";
    const deviceModel = Device.modelName ?? "unknown";
    const osVersion = Device.osVersion ?? "unknown";

    const lines: string[] = [
      `Nedaa Alarm Report`,
      `Issue: ${category}`,
      `App: ${appVersion} (${buildNumber})`,
      `Device: ${deviceModel}, ${Platform.OS} ${osVersion}`,
    ];

    try {
      const authStatus = await ExpoAlarm.getAuthorizationStatus();
      lines.push(`Auth: ${authStatus}`);
    } catch {
      // skip
    }

    try {
      const alarmIds = await ExpoAlarm.getScheduledAlarmIds();
      lines.push(`Alarms: ${alarmIds.length}`);
      const nextAlarmTime = ExpoAlarm.getNextAlarmTime();
      if (nextAlarmTime) {
        lines.push(`Next: ${new Date(nextAlarmTime).toLocaleString()}`);
      }
    } catch {
      // skip
    }

    return lines.join("\n");
  },

  async shareLog(category?: IssueCategory) {
    try {
      const log = await this.getFullDebugLog(category);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `nedaa-alarm-log-${timestamp}.txt`;
      const file = new File(Paths.cache, fileName);

      try {
        file.create();
      } catch {
        // file may already exist, overwrite
      }
      file.write(log);

      if (Platform.OS === "ios") {
        await Share.share({ url: file.uri });
      } else {
        await Share.share({
          message: log,
          title: fileName,
        });
      }
    } catch (e) {
      console.error("Failed to share log:", e);
    }
  },
};

export default AlarmLogger;

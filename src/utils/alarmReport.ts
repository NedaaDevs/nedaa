import * as ExpoAlarm from "expo-alarm";
import * as Application from "expo-application";
import * as Clipboard from "expo-clipboard";
import * as Device from "expo-device";
import { File, Paths } from "expo-file-system";
import { Platform, Share } from "react-native";

import { AppLogger } from "./appLogger";

const log = AppLogger.create("alarm");
export { log as alarmLog };

export const ISSUE_CATEGORIES = [
  "alarm_not_firing",
  "wrong_time",
  "no_sound",
  "cant_dismiss",
  "other",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export async function getAlarmDiagnosticReport(category?: IssueCategory): Promise<string> {
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

  sections.push("--- Native Logs ---");
  try {
    const nativeLog = ExpoAlarm.getPersistentLog();
    sections.push(nativeLog || "(empty)");
  } catch (e) {
    sections.push(`(error: ${e})`);
  }
  sections.push("");

  sections.push("--- App Logs ---");
  try {
    const logText = await log.getLogText();
    sections.push(logText || "(empty)");
  } catch (e) {
    sections.push(`(error: ${e})`);
  }
  sections.push("");

  return sections.join("\n");
}

export async function getAlarmSummary(category: IssueCategory): Promise<string> {
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
}

export async function copyAlarmReport(category?: IssueCategory): Promise<boolean> {
  try {
    const report = await getAlarmDiagnosticReport(category);
    await Clipboard.setStringAsync(report);
    return true;
  } catch (e) {
    console.error("Failed to copy report:", e);
    return false;
  }
}

export async function shareAlarmReport(category?: IssueCategory): Promise<void> {
  try {
    const report = await getAlarmDiagnosticReport(category);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `nedaa-alarm-report-${timestamp}.txt`;
    const file = new File(Paths.cache, fileName);

    try {
      file.create();
    } catch {
      // file may already exist
    }
    file.write(report);

    if (Platform.OS === "ios") {
      await Share.share({ url: file.uri });
    } else {
      await Share.share({ message: report, title: fileName });
    }
  } catch (e) {
    console.error("Failed to share report:", e);
  }
}
